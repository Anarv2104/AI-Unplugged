const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { URL } = require('url');

loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const FRONTEND_DIR = path.join(ROOT, '..', 'frontend');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'submissions.csv');
const HAS_DIST = fs.existsSync(DIST_DIR);
const STATIC_ROOT = DIST_DIR;

const admin = tryRequire('firebase-admin');
const XLSX = tryRequire('xlsx');
const { createBrevoProvider, splitEmails } = require('./mailProvider');

const firebaseInitState = {
  resolvedPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : '',
  status: 'pending',
  message: 'Firebase Admin has not been initialized yet.'
};

const db = initializeFirebaseAdmin();
const mailProvider = createBrevoProvider({
  apiKey: process.env.BREVO_API_KEY || '',
  senderEmail: process.env.BREVO_SENDER_EMAIL || '',
  senderName: process.env.BREVO_SENDER_NAME || 'AI Unplugged'
});
const SERVER_VERSION = `local-${Math.floor(Date.now() / 1000)}`;
const geocodeCache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}

function tryRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (error) {
    try {
      return require(path.join(ROOT, 'functions', 'node_modules', moduleName));
    } catch (nestedError) {
      return null;
    }
  }
}

function initializeFirebaseAdmin() {
  if (!admin) {
    firebaseInitState.status = 'module-missing';
    firebaseInitState.message = 'firebase-admin could not be loaded from the backend runtime.';
    return null;
  }

  try {
    if (!admin.apps.length) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        ? path.resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : '';

      firebaseInitState.resolvedPath = serviceAccountPath;

      if (!serviceAccountPath) {
        firebaseInitState.status = 'missing-env';
        firebaseInitState.message = 'FIREBASE_SERVICE_ACCOUNT_PATH is not set.';
        return null;
      }

      if (!fs.existsSync(serviceAccountPath)) {
        firebaseInitState.status = 'missing-file';
        firebaseInitState.message = `Service account file was not found at ${serviceAccountPath}.`;
        return null;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    firebaseInitState.status = 'ready';
    firebaseInitState.message = `Firebase Admin initialized using ${firebaseInitState.resolvedPath}.`;
    return admin.firestore();
  } catch (error) {
    firebaseInitState.status = 'init-failed';
    firebaseInitState.message = error.message || 'Firebase Admin initialization failed.';
    console.error('Firebase Admin initialization failed:', error.message);
    return null;
  }
}

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, 'submittedAt,form,name,email,phone,linkedin,college,year,city,hasOrganized,organizedDetail,whyNodeLead,firstEventEstimate,currentlyBuilding,role,organization,event,building,whyEvent,social\n');
  }
}

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvRow(payload) {
  const columns = [
    'submittedAt', 'form', 'name', 'email', 'phone', 'linkedin', 'college', 'year',
    'city', 'hasOrganized', 'organizedDetail', 'whyNodeLead', 'firstEventEstimate',
    'currentlyBuilding', 'role', 'organization', 'event', 'building', 'whyEvent', 'social'
  ];
  return columns.map((key) => escapeCsv(payload[key])).join(',') + '\n';
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendError(res, error) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  const details = error instanceof HttpError ? error.details : null;
  sendJson(res, statusCode, { ok: false, error: message, details });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function resolvePath(urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  return path.join(STATIC_ROOT, filePath);
}

function validateLegacySubmission(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid submission payload.';
  if (!payload.form || (payload.form !== 'attend' && payload.form !== 'node-lead')) return 'Invalid form type.';
  if (!payload.name || !payload.email) return 'Name and email are required.';
  return null;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeMapAddress(event) {
  return String(event?.mapAddress || event?.location || '').trim();
}

function buildMapLink(event) {
  const lat = Number(event?.mapLat);
  const lng = Number(event?.mapLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const address = normalizeMapAddress(event);
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
}

async function geocodeAddress(address) {
  const normalized = String(address || '').trim();
  if (!normalized) throw new HttpError(400, 'Address is required.');

  const cacheKey = normalized.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalized)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AI-Unplugged/1.0 (local geocoder)',
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new HttpError(502, 'Address lookup failed. Please try again.');
  }

  const results = await response.json();
  if (!Array.isArray(results) || !results.length) {
    throw new HttpError(404, 'Could not resolve that address. Try a more specific location.');
  }

  const match = results[0];
  const resolved = {
    address: match.display_name || normalized,
    lat: Number(match.lat),
    lng: Number(match.lon),
    mapLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.display_name || normalized)}`
  };
  geocodeCache.set(cacheKey, resolved);
  return resolved;
}

async function handleProfileNewsletter(req, res) {
  requireDb();
  const authContext = await getAuthContext(req);
  const payload = await readJson(req);
  const subscribed = payload?.subscribed !== false;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const email = String(authContext.token.email || '').trim();

  await db.collection('users').doc(authContext.uid).set({
    email,
    newsletterSubscribed: subscribed,
    updatedAt: now
  }, { merge: true });

  if (email) {
    await db.collection('newsletterSubscribers').doc(slugify(email)).set({
      email,
      status: subscribed ? 'subscribed' : 'unsubscribed',
      userId: authContext.uid,
      updatedAt: now,
      createdAt: now
    }, { merge: true });
  }

  sendJson(res, 200, { ok: true, subscribed });
}

function normalizeFieldValue(field, raw) {
  if (field.type === 'checkbox') return Boolean(raw);
  if (field.type === 'number') return raw === '' || raw == null ? '' : Number(raw);
  return typeof raw === 'string' ? raw.trim() : raw ?? '';
}

function fieldVisible(field, answers) {
  if (!field.showWhen) return true;
  return answers[field.showWhen.field] === field.showWhen.equals;
}

function validateAnswers(schema, answers) {
  const normalized = {};
  const errors = {};

  for (const field of schema.fields || []) {
    if (field.type === 'helper' || field.type === 'section') continue;
    if (!fieldVisible(field, answers)) continue;

    const value = normalizeFieldValue(field, answers[field.id]);
    normalized[field.id] = value;

    const empty =
      value === '' ||
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      value === false;

    if (field.required && empty) {
      errors[field.id] = 'This field is required.';
      continue;
    }

    if (field.type === 'email' && value) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!ok) errors[field.id] = 'Please enter a valid email address.';
    }

    if (field.minLength && typeof value === 'string' && value.length < field.minLength) {
      errors[field.id] = `Please enter at least ${field.minLength} characters.`;
    }
  }

  return { normalized, errors };
}

function flattenRow(row) {
  const answers = row.answers || {};
  const clean = { ...row };
  delete clean.answers;

  for (const [key, value] of Object.entries(clean)) {
    clean[key] = serializeValue(value);
  }

  for (const [key, value] of Object.entries(answers)) {
    clean[key] = serializeValue(value);
  }

  return clean;
}

function serializeValue(value) {
  if (value == null) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new HttpError(400, 'Malformed JSON request.'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'Could not read request body.')));
  });
}

function requireDb() {
  if (!db || !admin) {
    throw new HttpError(503, `Backend Firebase Admin is not configured. ${firebaseInitState.message}`);
  }
}

async function getAuthContext(req, { optional = false } = {}) {
  requireDb();
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    if (optional) return null;
    throw new HttpError(401, 'You must be logged in.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    return {
      uid: decodedToken.uid,
      token: decodedToken
    };
  } catch (error) {
    if (optional) return null;
    throw new HttpError(401, 'Your session is invalid. Please log in again.');
  }
}

async function requireAdminAuth(req) {
  const authContext = await getAuthContext(req);
  if (authContext.token.admin === true) return authContext;
  throw new HttpError(403, 'Admin access required.');
}

async function countAdmins() {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  return snap.size;
}

async function resolveUid({ uid, email }) {
  if (uid) return uid;
  if (email) {
    const user = await admin.auth().getUserByEmail(String(email).trim());
    return user.uid;
  }
  throw new HttpError(400, 'A uid or email is required.');
}

async function setAdminState(uid, isAdmin) {
  const userRecord = await admin.auth().getUser(uid);
  const nextClaims = { ...(userRecord.customClaims || {}) };

  if (isAdmin) nextClaims.admin = true;
  else delete nextClaims.admin;

  await admin.auth().setCustomUserClaims(uid, nextClaims);
  await db.collection('users').doc(uid).set({
    role: isAdmin ? 'admin' : 'user',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function applyBootstrapAdminIfNeeded(userRecord) {
  if (!userRecord?.email) return false;
  const allowlist = splitEmails(process.env.BOOTSTRAP_ADMIN_EMAILS || '');
  if (!allowlist.length) return false;
  if (!allowlist.includes(String(userRecord.email).toLowerCase())) return false;
  if (userRecord.customClaims?.admin === true) return false;
  await setAdminState(userRecord.uid, true);
  return true;
}

async function getSchemaForKind({ kind, schemaId }) {
  if (schemaId) {
    const document = await db.collection('eventForms').doc(schemaId).get();
    if (!document.exists) throw new HttpError(404, 'Form schema not found.');
    return { id: document.id, ...document.data() };
  }

  const snap = await db.collection('eventForms')
    .where('kind', '==', kind)
    .where('isDefault', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpError(412, `Default ${kind} schema is missing.`);
  }

  const document = snap.docs[0];
  return { id: document.id, ...document.data() };
}

function getSetupWarnings() {
  const warnings = [];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    warnings.push('FIREBASE_SERVICE_ACCOUNT_PATH is missing.');
  } else if (!fs.existsSync(path.resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH))) {
    warnings.push('FIREBASE_SERVICE_ACCOUNT_PATH does not point to an existing file.');
  }
  if (!process.env.BREVO_API_KEY) warnings.push('BREVO_API_KEY is missing.');
  if (!process.env.BREVO_SENDER_EMAIL) warnings.push('BREVO_SENDER_EMAIL is missing.');
  if (splitEmails(process.env.BOOTSTRAP_ADMIN_EMAILS || '').length === 0) {
    warnings.push('BOOTSTRAP_ADMIN_EMAILS is empty.');
  }
  if (!admin) warnings.push('firebase-admin is not installed for the backend runtime.');
  if (!XLSX) warnings.push('xlsx is not installed, so spreadsheet exports are unavailable.');
  return warnings;
}

function getSetupDiagnostics() {
  return {
    firebaseAdmin: {
      status: firebaseInitState.status,
      message: firebaseInitState.message,
      resolvedPath: firebaseInitState.resolvedPath || '',
      fileExists: firebaseInitState.resolvedPath ? fs.existsSync(firebaseInitState.resolvedPath) : false
    },
    warnings: getSetupWarnings()
  };
}

async function resolveUpdateDocument({ updateId, updateSlug, title, excerpt, commentMode }) {
  let updateDoc = updateId ? await db.collection('updates').doc(updateId).get() : null;

  if ((!updateDoc || !updateDoc.exists) && updateSlug) {
    const snap = await db.collection('updates').where('slug', '==', updateSlug).limit(1).get();
    if (!snap.empty) updateDoc = snap.docs[0];
  }

  if (updateDoc && updateDoc.exists) {
    return { id: updateDoc.id, data: updateDoc.data() };
  }

  if (!updateSlug && !updateId) return null;

  const docId = updateId || updateSlug;
  const payload = {
    slug: updateSlug || updateId,
    title: title || 'Update',
    excerpt: excerpt || '',
    body: [],
    bodyHtml: '',
    category: 'update',
    publishState: 'published',
    commentMode: commentMode || 'moderated',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('updates').doc(docId).set(payload, { merge: true });
  return { id: docId, data: payload };
}

function makeRegistrationId() {
  return `AIU-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function htmlToParagraphs(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\r?\n\r?\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\r?\n/g, '<br />')}</p>`)
    .join('');
}

function normalizeUploadBase64(upload) {
  const base64 = String(upload?.base64 || '');
  const clean = base64.includes(',') ? base64.split(',').pop() : base64;
  return Buffer.from(clean || '', 'base64');
}

function extractRecipientsFromUpload(upload) {
  if (!XLSX) throw new HttpError(503, 'Spreadsheet parsing support is unavailable in the backend runtime.');
  const buffer = normalizeUploadBase64(upload);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  const emails = new Set();

  for (const row of rows) {
    for (const cell of row || []) {
      const value = String(cell || '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) emails.add(value.toLowerCase());
    }
  }

  return [...emails];
}

function importContentText(upload) {
  const buffer = normalizeUploadBase64(upload);
  const extension = String(upload?.filename || '').toLowerCase();

  if (extension.endsWith('.txt')) {
    const text = buffer.toString('utf8');
    return {
      text,
      html: textToHtml(text)
    };
  }

  if (extension.endsWith('.docx')) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiu-docx-'));
    const sourcePath = path.join(tempDir, upload.filename || 'upload.docx');
    fs.writeFileSync(sourcePath, buffer);
    try {
      const text = execFileSync('textutil', ['-convert', 'txt', '-stdout', sourcePath], {
        encoding: 'utf8'
      });
      return {
        text,
        html: textToHtml(text)
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // ignore cleanup errors in local mode
      }
    }
  }

  throw new HttpError(400, 'Unsupported content file. Upload .txt or .docx.');
}

async function handleEventRegistration(req, res) {
  requireDb();
  const payload = await readJson(req);
  const authContext = await getAuthContext(req);
  const { eventId, answers } = payload;

  if (!eventId) throw new HttpError(400, 'Event is required.');

  const eventDoc = await db.collection('events').doc(eventId).get();
  if (!eventDoc.exists) throw new HttpError(404, 'Event not found.');
  const event = eventDoc.data();
  if (event.publishState !== 'published') {
    throw new HttpError(412, 'Event is not open for registration.');
  }

  const schema = await getSchemaForKind({ kind: 'event', schemaId: event.formId || null });
  const { normalized, errors } = validateAnswers(schema, answers || {});
  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Validation failed.', { errors });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const email = normalized.email || payload.email || '';
  const registrationId = makeRegistrationId();

  const registration = {
    registrationId,
    eventId,
    eventTitle: event.title,
    formId: schema.id,
    formTitle: schema.title,
    answers: normalized,
    reviewStatus: 'pending',
    source: 'member',
    userId: authContext.uid,
    name: normalized.name || payload.name || '',
    email,
    organization: normalized.organization || '',
    createdAt: now,
    updatedAt: now,
    subscribedToNewsletter: true
  };

  const docRef = await db.collection('eventRegistrations').add(registration);

  await db.collection('users').doc(authContext.uid).set({
    email: authContext.token.email || email || '',
    displayName: authContext.token.name || normalized.name || '',
    newsletterSubscribed: true,
    updatedAt: now
  }, { merge: true });

  if (email) {
    await db.collection('newsletterSubscribers').doc(slugify(email)).set({
      email,
      status: 'subscribed',
      source: 'registration-member',
      userId: authContext.uid,
      updatedAt: now,
      createdAt: now
    }, { merge: true });

    const safeTitle = escapeHtml(event.title || '');
    const safeId = escapeHtml(registrationId);
    const displayAddress = normalizeMapAddress(event);
    const mapLink = buildMapLink(event);
    const safeAddress = escapeHtml(displayAddress);
    const safeMapLink = escapeHtml(mapLink);
    const htmlLocationBlock = displayAddress
      ? `<p><strong>Location:</strong> ${safeAddress}</p>${mapLink ? `<p><a href="${safeMapLink}">Open directions</a></p>` : ''}`
      : '';
    const textLocationBlock = displayAddress
      ? `\nLocation: ${displayAddress}${mapLink ? `\nDirections: ${mapLink}` : ''}`
      : '';
    await mailProvider.sendTransactionalEmail({
      to: email,
      subject: `Registration confirmed: ${event.title}`,
      html: `<p>Your registration for <strong>${safeTitle}</strong> is confirmed.</p><p>Your registration ID is <strong>${safeId}</strong>.</p>${htmlLocationBlock}`,
      text: `Your registration for ${event.title} is confirmed. Registration ID: ${registrationId}${textLocationBlock}`
    });
  }

  sendJson(res, 200, { ok: true, id: docRef.id, registrationId });
}

async function handleNodeLeadApplication(req, res) {
  requireDb();
  const payload = await readJson(req);
  const authContext = await getAuthContext(req, { optional: true });
  const schema = await getSchemaForKind({ kind: 'nodeLead', schemaId: payload.schemaId || null });
  const { normalized, errors } = validateAnswers(schema, payload.answers || {});

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Validation failed.', { errors });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('nodeLeadApplications').add({
    formId: schema.id,
    formTitle: schema.title,
    answers: normalized,
    email: normalized.email || '',
    name: normalized.name || '',
    reviewStatus: 'pending',
    userId: authContext ? authContext.uid : null,
    createdAt: now,
    updatedAt: now
  });

  sendJson(res, 200, { ok: true, id: docRef.id });
}

async function handleHostApplication(req, res) {
  requireDb();
  const payload = await readJson(req);
  const answers = payload.answers || {};
  const errors = {};
  const requiredFields = [
    ['name', 'Name is required.'],
    ['email', 'Email is required.'],
    ['countryCode', 'Country code is required.'],
    ['phone', 'Contact number is required.'],
    ['subject', 'Subject is required.'],
    ['venue', 'Venue is required.'],
    ['venueCapacity', 'Venue capacity is required.'],
    ['estimatedAudience', 'Estimated audience is required.']
  ];

  for (const [field, message] of requiredFields) {
    if (!String(answers[field] ?? '').trim()) errors[field] = message;
  }

  if (answers.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers.email).trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Validation failed.', { errors });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const email = String(answers.email || '').trim();

  const docRef = await db.collection('hostApplications').add({
    answers: {
      ...answers,
      name: String(answers.name || '').trim(),
      email,
      countryCode: String(answers.countryCode || '').trim(),
      phone: String(answers.phone || '').trim(),
      subject: String(answers.subject || '').trim(),
      venue: String(answers.venue || '').trim(),
      venueCapacity: Number(answers.venueCapacity),
      estimatedAudience: Number(answers.estimatedAudience),
      details: String(answers.details || '').trim()
    },
    name: String(answers.name || '').trim(),
    email,
    countryCode: String(answers.countryCode || '').trim(),
    phone: String(answers.phone || '').trim(),
    subject: String(answers.subject || '').trim(),
    venue: String(answers.venue || '').trim(),
    venueCapacity: Number(answers.venueCapacity),
    estimatedAudience: Number(answers.estimatedAudience),
    reviewStatus: 'pending',
    createdAt: now,
    updatedAt: now
  });

  sendJson(res, 200, { ok: true, id: docRef.id });
}

async function handleUpdateComment(req, res) {
  requireDb();
  const authContext = await getAuthContext(req);
  const payload = await readJson(req);
  const { updateId, updateSlug, title, excerpt, commentMode, body } = payload;

  if ((!updateId && !updateSlug) || !String(body || '').trim()) {
    throw new HttpError(400, 'Update and comment body are required.');
  }

  const resolved = await resolveUpdateDocument({ updateId, updateSlug, title, excerpt, commentMode });
  if (!resolved) throw new HttpError(404, 'Update not found.');
  const update = resolved.data;
  if (update.publishState !== 'published') {
    throw new HttpError(412, 'Update is not available.');
  }
  if (update.commentMode === 'disabled') {
    throw new HttpError(412, 'Comments are disabled for this post.');
  }

  const status = update.commentMode === 'moderated' ? 'pending' : 'approved';
  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('comments').add({
    updateId: resolved.id,
    updateSlug: update.slug,
    body: String(body).trim(),
    status,
    userId: authContext.uid,
    authorName: authContext.token.name || authContext.token.email || 'Member',
    authorEmail: authContext.token.email || '',
    createdAt: now,
    updatedAt: now
  });

  sendJson(res, 200, { ok: true, id: docRef.id, status });
}

async function handleExport(req, res) {
  requireDb();
  await requireAdminAuth(req);
  if (!XLSX) throw new HttpError(503, 'Spreadsheet export support is unavailable. Install xlsx in the backend runtime.');

  const payload = await readJson(req);
  const dataset = payload.dataset === 'nodeLeadApplications' ? 'nodeLeadApplications' : 'eventRegistrations';
  const format = payload.format || 'csv';
  let exportQuery = db.collection(dataset);
  if (dataset === 'eventRegistrations' && payload.eventId) {
    exportQuery = exportQuery.where('eventId', '==', payload.eventId);
  }
  const snap = await exportQuery.get();
  const rows = snap.docs.map((document) => ({ id: document.id, ...document.data() }));

  if (format === 'json') {
    sendJson(res, 200, {
      ok: true,
      filename: `${dataset}.json`,
      mimeType: 'application/json',
      base64: Buffer.from(JSON.stringify(rows.map(flattenRow), null, 2)).toString('base64')
    });
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows.map(flattenRow));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

  if (format === 'xlsx') {
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    sendJson(res, 200, {
      ok: true,
      filename: `${dataset}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(buffer).toString('base64')
    });
    return;
  }

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  sendJson(res, 200, {
    ok: true,
    filename: `${dataset}.csv`,
    mimeType: 'text/csv',
    base64: Buffer.from(csv).toString('base64')
  });
}

async function handleNewsletterCampaign(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const { subject, html, text, recipientsUpload } = payload;

  if (!subject || !html) {
    throw new HttpError(400, 'Subject and HTML content are required.');
  }

  let recipients = [];
  if (recipientsUpload?.base64) {
    recipients = extractRecipientsFromUpload(recipientsUpload).slice(0, 300);
  } else {
    const subscribersSnap = await db.collection('newsletterSubscribers')
      .where('status', '==', 'subscribed')
      .get();

    recipients = subscribersSnap.docs
      .map((document) => document.data().email)
      .filter(Boolean)
      .slice(0, 300);
  }

  if (!recipients.length) {
    sendJson(res, 200, { ok: true, sent: 0 });
    return;
  }

  await mailProvider.sendCampaignEmail({ recipients, subject, html, text });

  await db.collection('newsletterCampaigns').add({
    subject,
    html,
    text: text || '',
    recipients: recipients.length,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'sent'
  });

  sendJson(res, 200, { ok: true, sent: recipients.length });
}

async function handleDashboardData(req, res) {
  requireDb();
  const authContext = await getAuthContext(req);

  const registrationsSnap = await db.collection('eventRegistrations')
    .where('userId', '==', authContext.uid)
    .get();

  const registrations = registrationsSnap.docs.map((document) => ({ id: document.id, ...document.data() }));

  const updatesSnap = await db.collection('updates')
    .where('publishState', '==', 'published')
    .get();

  const updates = updatesSnap.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const eventIds = new Set(registrations.map((item) => item.eventId).filter(Boolean));
  const recentUpdates = updates.slice(0, 3);
  const missed = updates.filter((item) => item.category === 'event-recap' || item.scope === 'event').slice(0, 3);
  const eventUpdates = updates.filter((item) => item.eventId && eventIds.has(item.eventId)).slice(0, 3);

  sendJson(res, 200, {
    ok: true,
    registrations,
    recentUpdates,
    missed,
    eventUpdates
  });
}

async function handleSyncCurrentUser(req, res) {
  requireDb();
  const authContext = await getAuthContext(req);
  const userRecord = await admin.auth().getUser(authContext.uid);
  const bootstrapApplied = await applyBootstrapAdminIfNeeded(userRecord);

  const profileRef = db.collection('users').doc(authContext.uid);
  const existingProfile = await profileRef.get();
  await profileRef.set({
    email: userRecord.email || authContext.token.email || '',
    displayName: userRecord.displayName || authContext.token.name || '',
    role: bootstrapApplied || userRecord.customClaims?.admin === true ? 'admin' : 'user',
    newsletterSubscribed: existingProfile.exists ? existingProfile.data().newsletterSubscribed !== false : true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const profileSnap = await profileRef.get();
  sendJson(res, 200, {
    ok: true,
    profile: { id: profileSnap.id, ...profileSnap.data() },
    claimsUpdated: bootstrapApplied,
    setupWarnings: getSetupWarnings()
  });
}

async function handleListAdmins(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  sendJson(res, 200, {
    ok: true,
    admins: snap.docs.map((document) => ({ id: document.id, ...document.data() }))
  });
}

async function handleGrantAdmin(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const targetUid = await resolveUid(payload || {});
  await setAdminState(targetUid, true);
  sendJson(res, 200, { ok: true, uid: targetUid });
}

async function handleRevokeAdmin(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const targetUid = await resolveUid(payload || {});
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new HttpError(412, 'At least one admin must remain on the platform.');
  }
  await setAdminState(targetUid, false);
  sendJson(res, 200, { ok: true, uid: targetUid });
}

async function handleLeaveAdmin(req, res) {
  requireDb();
  const authContext = await requireAdminAuth(req);
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new HttpError(412, 'You must assign another admin before removing your own admin access.');
  }
  await setAdminState(authContext.uid, false);
  sendJson(res, 200, { ok: true, uid: authContext.uid });
}

async function handleSetupStatus(req, res) {
  sendJson(res, 200, {
    ok: true,
    mailProvider: mailProvider.providerName,
    warnings: getSetupWarnings(),
    diagnostics: getSetupDiagnostics(),
    version: SERVER_VERSION
  });
}

async function handleGeocode(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const result = await geocodeAddress(payload?.address || '');
  sendJson(res, 200, { ok: true, ...result });
}

async function handleImportContent(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const result = importContentText(payload.upload || {});
  sendJson(res, 200, { ok: true, ...result });
}

async function handleSaveUpdate(req, res) {
  requireDb();
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const scope = payload.scope === 'event' ? 'event' : 'general';
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docId = payload.id || db.collection('updates').doc().id;
  let eventTitle = '';
  if (scope === 'event') {
    if (!payload.eventId) throw new HttpError(400, 'Event-specific updates require an event.');
    const eventDoc = await db.collection('events').doc(payload.eventId).get();
    if (!eventDoc.exists) throw new HttpError(404, 'Selected event not found.');
    eventTitle = eventDoc.data().title || '';
  }

  const updatePayload = {
    title: payload.title || '',
    slug: payload.slug || slugify(payload.title || docId),
    excerpt: payload.excerpt || '',
    body: payload.body || htmlToParagraphs(payload.bodyHtml || ''),
    bodyHtml: payload.bodyHtml || '',
    category: payload.category || 'update',
    commentMode: payload.commentMode || 'moderated',
    publishState: payload.publishState || 'draft',
    authorName: payload.authorName || 'AI Unplugged Team',
    scope,
    eventId: scope === 'event' ? payload.eventId : null,
    eventTitle,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    updatedAt: now
  };

  if (updatePayload.publishState === 'published' && !payload.publishedAt) {
    updatePayload.publishedAt = new Date().toISOString();
  }

  await db.collection('updates').doc(docId).set({
    ...updatePayload,
    createdAt: payload.id ? now : now
  }, { merge: true });

  if (scope === 'event' && updatePayload.publishState === 'published') {
    const registrationsSnap = await db.collection('eventRegistrations')
      .where('eventId', '==', payload.eventId)
      .get();

    const recipients = registrationsSnap.docs
      .map((document) => document.data().email)
      .filter(Boolean)
      .slice(0, 300);

    if (recipients.length) {
      await mailProvider.sendCampaignEmail({
        recipients,
        subject: payload.title,
        html: payload.bodyHtml || textToHtml(updatePayload.body.join('\n\n')),
        text: updatePayload.body.join('\n\n')
      });
    }
  }

  sendJson(res, 200, { ok: true, id: docId });
}

ensureDataStore();

console.info(
  `[AIU backend] boot version=${SERVER_VERSION} firebase=${firebaseInitState.status} path=${firebaseInitState.resolvedPath || 'unset'}`
);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  const htmlRouteMap = {
    '/index.html': '/',
    '/events.html': '/events',
    '/event.html': '/event',
    '/apply.html': '/attend',
    '/node-lead.html': '/node-lead',
    '/about.html': '/about',
    '/thank-you.html': '/thank-you'
  };

  try {
    if (req.method === 'POST' && url.pathname === '/api/submissions') {
      const payload = await readJson(req);
      const error = validateLegacySubmission(payload);
      if (error) throw new HttpError(400, error);
      payload.submittedAt = payload.submittedAt || new Date().toISOString();
      fs.appendFileSync(CSV_PATH, toCsvRow(payload));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/registrations/event') {
      await handleEventRegistration(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/node-leads') {
      await handleNodeLeadApplication(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/hosts') {
      await handleHostApplication(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/comments') {
      await handleUpdateComment(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/profile/newsletter') {
      await handleProfileNewsletter(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/platform/health') {
      sendJson(res, 200, { ok: true, version: SERVER_VERSION, diagnostics: getSetupDiagnostics() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/exports') {
      await handleExport(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/newsletter') {
      await handleNewsletterCampaign(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/import-content') {
      await handleImportContent(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/auth/sync') {
      await handleSyncCurrentUser(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/platform/dashboard') {
      await handleDashboardData(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/platform/admins') {
      await handleListAdmins(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/admins/grant') {
      await handleGrantAdmin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/admins/revoke') {
      await handleRevokeAdmin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/admins/leave') {
      await handleLeaveAdmin(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/platform/setup-status') {
      await handleSetupStatus(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/geocode') {
      await handleGeocode(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/platform/updates') {
      await handleSaveUpdate(req, res);
      return;
    }
  } catch (error) {
    sendError(res, error);
    return;
  }

  if (htmlRouteMap[url.pathname]) {
    redirect(res, `${htmlRouteMap[url.pathname]}${url.search}`);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const filePath = resolvePath(url.pathname);
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    const fallback = path.join(STATIC_ROOT, 'index.html');
    if (HAS_DIST && (url.pathname === '/' || path.extname(url.pathname) === '')) {
      sendFile(res, fallback);
      return;
    }

    if (!HAS_DIST) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Frontend build not found. Run the frontend build first.');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Unplugged running at http://localhost:${PORT}`);
  console.log(`Serving frontend from ${DIST_DIR}`);
  console.log(`Saving legacy submissions to ${CSV_PATH}`);
  console.log(`Firebase Admin status: ${firebaseInitState.status}`);
  console.log(`Firebase Admin detail: ${firebaseInitState.message}`);
  if (firebaseInitState.resolvedPath) {
    console.log(`Firebase Admin service account path: ${firebaseInitState.resolvedPath}`);
  }
});
