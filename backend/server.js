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
const ExcelJS = tryRequire('exceljs');
const { createBrevoProvider, splitEmails } = require('./mailProvider');
const { prisma } = require('./src/db');
const { LOG_DIR, ACTIVITY_LOG_PATH, ERROR_LOG_PATH, logActivity, logError } = require('./src/logger');
const {
  STORAGE_DRIVER,
  UPLOAD_DIR,
  ensureUploadDir,
  saveUpload,
  deleteUpload,
  resolveServePath,
  storageKeyFromUrl,
  getStorageDiagnostics,
  s3ConfigWarnings
} = require('./src/storage');

const firebaseInitState = {
  resolvedPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : '',
  status: 'pending',
  message: 'Firebase Admin has not been initialized yet.'
};

const authReady = initializeFirebaseAdmin();
const mailProvider = createBrevoProvider({
  apiKey: process.env.BREVO_API_KEY || '',
  senderEmail: process.env.BREVO_SENDER_EMAIL || '',
  senderName: process.env.BREVO_SENDER_NAME || 'AI Unplugged'
});
const SERVER_VERSION = `local-${Math.floor(Date.now() / 1000)}`;
const geocodeCache = new Map();
const SKILL_MAX_FILE_SIZE = 2 * 1024 * 1024;
const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const FORM_FIELD_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'number', 'select', 'radio', 'checkbox', 'url', 'helper']);

const BUILT_IN_DEFAULT_EVENT_SCHEMA = {
  id: 'default-event-form',
  kind: 'event',
  title: 'Default Event Registration Form',
  isDefault: true,
  publishState: 'published',
  fields: [
    { id: 'name', type: 'text', label: 'Full name', required: true, placeholder: '' },
    { id: 'email', type: 'email', label: 'Email', required: true, placeholder: '' },
    { id: 'role', type: 'select', label: 'Role', required: true, options: ['Student', 'Builder', 'Founder', 'Operator', 'Other'] },
    { id: 'organization', type: 'text', label: 'Organization / College', required: true },
    { id: 'building', type: 'textarea', label: 'What are you building right now?', required: true, minLength: 20, helperText: '20-500 characters', placeholder: 'Short and honest. Rough projects count.' },
    { id: 'whyEvent', type: 'textarea', label: 'Why this event?', required: true, minLength: 15, placeholder: "Be specific. 'To network' is not a reason." },
    { id: 'social', type: 'url', label: 'LinkedIn / Twitter / Website', required: false, helperText: 'Optional' }
  ]
};

const BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA = {
  id: 'default-node-lead-form',
  kind: 'nodeLead',
  title: 'Default Node Lead Application',
  isDefault: true,
  publishState: 'published',
  fields: [
    { id: 'name', type: 'text', label: 'Full name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'phone', type: 'phone', label: 'Phone', required: false, helperText: 'Optional' },
    { id: 'linkedin', type: 'url', label: 'LinkedIn', required: true, placeholder: 'https://linkedin.com/in/...' },
    { id: 'college', type: 'text', label: 'College / University', required: true },
    { id: 'year', type: 'select', label: 'Year of study', required: true, options: ['1st year', '2nd year', '3rd year', '4th year', 'Postgrad', 'Recent grad', 'Other'] },
    { id: 'city', type: 'text', label: 'City', required: true },
    { id: 'hasOrganized', type: 'radio', label: 'Have you organized events before?', required: true, options: ['Yes', 'No'] },
    { id: 'organizedDetail', type: 'textarea', label: 'Describe what you organized', required: true, minLength: 15, showWhen: { field: 'hasOrganized', equals: 'Yes' }, placeholder: 'Event name, scale, what you actually did.' },
    { id: 'whyNodeLead', type: 'textarea', label: 'Why do you want to run AI Unplugged at your campus?', required: true, minLength: 40, placeholder: 'Specific beats generic. What is missing at your campus? What will you build?' },
    { id: 'firstEventEstimate', type: 'number', label: 'How many builders can you bring to the first event?', required: true },
    { id: 'currentlyBuilding', type: 'textarea', label: "Anything you're currently building?", required: false, helperText: 'Optional', placeholder: 'Projects, side products, papers, research - anything counts.' }
  ]
};

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
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
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
    return false;
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
        return false;
      }

      if (!fs.existsSync(serviceAccountPath)) {
        firebaseInitState.status = 'missing-file';
        firebaseInitState.message = `Service account file was not found at ${serviceAccountPath}.`;
        return false;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    firebaseInitState.status = 'ready';
    firebaseInitState.message = `Firebase Admin initialized using ${firebaseInitState.resolvedPath}.`;
    return true;
  } catch (error) {
    firebaseInitState.status = 'init-failed';
    firebaseInitState.message = error.message || 'Firebase Admin initialization failed.';
    console.error('Firebase Admin initialization failed:', error.message);
    return false;
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
  res.end(JSON.stringify(body, jsonReplacer));
}

function jsonReplacer(_key, value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
}

function getSafeErrorMessage(error, statusCode) {
  if (error instanceof HttpError && statusCode < 500) return error.message;
  if (statusCode === 401) return 'Please log in and try again.';
  if (statusCode === 403) return 'You do not have access to this action.';
  if (statusCode === 404) return 'We could not find what you were looking for.';
  return 'Something went wrong on our side. Please try again in a moment.';
}

async function logAppError(req, error, statusCode, safeMessage) {
  try {
    const auth = await getAuthContext(req, { optional: true }).catch(() => null);
    await prisma.appErrorLog.create({
      data: {
        route: req?.url || '',
        method: req?.method || '',
        statusCode,
        safeMessage,
        internalMessage: error instanceof Error ? error.message : String(error || ''),
        stack: error instanceof Error ? String(error.stack || '').slice(0, 6000) : '',
        userId: auth?.uid || null
      }
    });
  } catch (logError) {
    console.error('[error log failed]', logError.message);
  }
}

async function sendError(req, res, error) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const safeMessage = getSafeErrorMessage(error, statusCode);
  if (statusCode >= 500) console.error('[server error]', error);
  logError('request_error', error, {
    route: req?.url || '',
    method: req?.method || '',
    statusCode,
    safeMessage,
    details: error instanceof HttpError ? error.details : null
  });
  if (statusCode >= 500 || !(error instanceof HttpError)) await logAppError(req, error, statusCode, safeMessage);
  const details = error instanceof HttpError ? error.details : null;
  sendJson(res, statusCode, { ok: false, error: safeMessage, details });
}

const rateLimitBuckets = new Map();
const RATE_LIMITS = {
  publicSubmission: { windowMs: 10 * 60 * 1000, max: 30 },
  comments: { windowMs: 10 * 60 * 1000, max: 40 },
  authProfile: { windowMs: 10 * 60 * 1000, max: 80 },
  uploads: { windowMs: 60 * 60 * 1000, max: 80 },
  adminMutation: { windowMs: 60 * 1000, max: 120 },
  apiDefault: { windowMs: 60 * 1000, max: 300 }
};

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function rateLimitGroup(req, url) {
  if (!url.pathname.startsWith('/api/')) return null;
  if (req.method === 'POST' && [
    '/api/submissions',
    '/api/platform/registrations/event',
    '/api/platform/node-leads',
    '/api/platform/hosts'
  ].includes(url.pathname)) return 'publicSubmission';
  if (url.pathname === '/api/platform/comments') return 'comments';
  if (url.pathname === '/api/platform/auth/sync' || url.pathname === '/api/platform/profile/newsletter') return 'authProfile';
  if (url.pathname.startsWith('/api/platform/uploads/')) return 'uploads';
  if (req.method !== 'GET' && (
    url.pathname === '/api/platform/newsletter' ||
    url.pathname === '/api/platform/exports' ||
    url.pathname.startsWith('/api/platform/admins') ||
    url.pathname.includes('/review') ||
    url.pathname.includes('/invites') ||
    url.pathname.startsWith('/api/platform/site-settings') ||
    url.pathname.startsWith('/api/platform/import-content')
  )) return 'adminMutation';
  if (req.method !== 'GET' && url.pathname.startsWith('/api/platform/')) return 'adminMutation';
  return 'apiDefault';
}

function enforceRateLimit(req, url) {
  const group = rateLimitGroup(req, url);
  if (!group) return;
  const rule = RATE_LIMITS[group] || RATE_LIMITS.apiDefault;
  const now = Date.now();
  const key = `${group}:${clientIp(req)}`;
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + rule.windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + rule.windowMs;
  }
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  if (bucket.count > rule.max) {
    throw new HttpError(429, 'Too many requests. Please wait a moment and try again.');
  }

  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, value] of rateLimitBuckets.entries()) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
}

function sendFile(res, filePath, extraHeaders = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type, ...extraHeaders });
    res.end(data);
  });
}

function getStaticCacheHeaders(filePath, urlPath = '') {
  const basename = path.basename(filePath);
  if (basename === 'index.html') {
    return { 'Cache-Control': 'no-cache, no-store, must-revalidate' };
  }

  const isHashedAsset = urlPath.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(basename);
  if (isHashedAsset) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }

  if (basename === 'robots.txt' || basename === 'sitemap.xml') {
    return { 'Cache-Control': 'public, max-age=3600' };
  }

  return { 'Cache-Control': 'no-cache' };
}

const ALLOWED_ATTACHMENT_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/markdown'
]);
const ALLOWED_RESOURCE_IMAGE_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif'
]);

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
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeUpdateResponse(update) {
  if (!update) return null;
  return {
    ...update,
    slug: slugify(update.slug || update.title || update.id || 'update')
  };
}

function normalizeResourceResponse(resource) {
  if (!resource) return null;
  return {
    ...resource,
    slug: slugify(resource.slug || resource.title || resource.id || 'resource')
  };
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

function buildEventApprovalEmail({ registration, event }) {
  const title = String(event?.title || registration?.eventTitle || 'AI Unplugged event').trim();
  const attendeeName = String(
    registration?.name || registration?.answers?.name || registration?.email || 'Builder'
  ).trim();
  const registrationId = String(registration?.registrationId || '').trim();
  const senderName = String(process.env.BREVO_SENDER_NAME || 'AI Unplugged').trim();

  const subject = `Registration confirmed: ${title}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto">
      <p>Hi ${escapeHtml(attendeeName)},</p>
      <p>Your registration for <strong>${escapeHtml(title)}</strong> has been approved.</p>
      <div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
        ${registrationId ? `<p style="margin:0 0 8px"><strong>Registration ID:</strong> ${escapeHtml(registrationId)}</p>` : ''}
        <p style="margin:0">We will share event-specific details closer to the session if needed.</p>
      </div>
      <p>Please keep this email for your reference. If there are any event-specific instructions, our team will share them with you before the session.</p>
      <p>We look forward to hosting you.</p>
      <p>Regards,<br />${escapeHtml(senderName)}</p>
    </div>
  `.trim();
  const text = [
    `Hi ${attendeeName},`,
    '',
    `Your registration for ${title} has been approved.`,
    '',
    registrationId ? `Registration ID: ${registrationId}` : null,
    'We will share event-specific details closer to the session if needed.',
    '',
    'Please keep this email for your reference. If there are any event-specific instructions, our team will share them with you before the session.',
    '',
    'We look forward to hosting you.',
    '',
    'Regards,',
    senderName
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

function normalizeEntryType(entry) {
  const value = String(entry || '').trim().toLowerCase();
  if (value === 'open') return 'open';
  if (value === 'invite only') return 'invite-only';
  if (value === 'curated') return 'curated';
  return 'application';
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const host = req?.headers?.host || `localhost:${PORT}`;
  return `http://${host}`;
}

function makeInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function eventCapacity(event) {
  const capacity = Number(event?.extra?.capacity ?? event?.capacity ?? 0);
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
}

async function countActiveRegistrations(eventId) {
  return prisma.eventRegistration.count({
    where: {
      eventId,
      reviewStatus: { not: 'rejected' }
    }
  });
}

async function sendInviteEmail(req, invite, event) {
  if (!invite.email) return;
  const link = `${publicBaseUrl(req)}/attend?event=${encodeURIComponent(invite.eventId)}&invite=${encodeURIComponent(invite.token)}`;
  const title = String(event?.title || 'AI Unplugged event').trim();
  const name = String(invite.name || invite.email || 'Builder').trim();
  const subject = `You're invited: ${title}`;
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You have been invited to register for <strong>${escapeHtml(title)}</strong>.</p>
    <p><a href="${escapeHtml(link)}">Open your invite</a></p>
    <p>This invite is tied to your email address.</p>
  `.trim();
  const text = `Hi ${name},\n\nYou have been invited to register for ${title}.\n\nOpen your invite: ${link}\n\nThis invite is tied to your email address.`;
  await mailProvider.sendTransactionalEmail({ to: invite.email, subject, html, text });
}

function getServerCapabilities() {
  return {
    skilldbUploadApi: true,
    storageDriver: STORAGE_DRIVER,
    rateLimiting: true,
    securityHeaders: true,
    routes: {
      createSkill: '/api/platform/skills',
      updateSkill: '/api/platform/skills/:id',
      deleteSkill: '/api/platform/skills/:id'
    }
  };
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

function normalizeFormFields(fields) {
  if (!Array.isArray(fields) || !fields.length) {
    throw new HttpError(400, 'Form must include at least one field.');
  }

  const seenIds = new Set();
  return fields.map((field, index) => {
    const id = String(field?.id || '').trim();
    const label = String(field?.label || '').trim();
    const type = String(field?.type || 'text').trim();

    if (!id) throw new HttpError(400, `Field ${index + 1} is missing an id.`);
    if (seenIds.has(id)) throw new HttpError(400, `Field id "${id}" is duplicated.`);
    if (!label) throw new HttpError(400, `Field ${index + 1} is missing a label.`);
    if (!FORM_FIELD_TYPES.has(type)) throw new HttpError(400, `Field "${label}" has an unsupported type.`);
    seenIds.add(id);

    const normalized = {
      id,
      type,
      label,
      required: Boolean(field.required)
    };
    const placeholder = String(field.placeholder || '').trim();
    const helperText = String(field.helperText || '').trim();
    if (placeholder) normalized.placeholder = placeholder;
    if (helperText) normalized.helperText = helperText;
    if (field.minLength != null && field.minLength !== '') {
      const minLength = Number(field.minLength);
      if (Number.isFinite(minLength) && minLength > 0) normalized.minLength = minLength;
    }
    if (field.showWhen && typeof field.showWhen === 'object') {
      normalized.showWhen = {
        field: String(field.showWhen.field || '').trim(),
        equals: String(field.showWhen.equals || '').trim()
      };
    }
    if (type === 'select' || type === 'radio') {
      const options = Array.isArray(field.options)
        ? field.options.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!options.length) throw new HttpError(400, `Field "${label}" needs at least one option.`);
      normalized.options = options;
    }
    return normalized;
  });
}

function buildFormSchemaSnapshot(schema) {
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  return {
    id: String(schema?.id || ''),
    kind: String(schema?.kind || ''),
    title: String(schema?.title || ''),
    isDefault: Boolean(schema?.isDefault),
    publishState: String(schema?.publishState || 'published'),
    fields: fields.map((field) => {
      const snapshot = {
        id: String(field?.id || ''),
        type: String(field?.type || 'text'),
        label: String(field?.label || ''),
        required: Boolean(field?.required)
      };
      for (const key of ['placeholder', 'helperText', 'minLength', 'options', 'showWhen']) {
        if (field?.[key] !== undefined) snapshot[key] = field[key];
      }
      return snapshot;
    })
  };
}

function flattenRow(row, { includeFormSchema = true } = {}) {
  const answers = (row && typeof row.answers === 'object' && row.answers) || {};
  const clean = { ...row };
  delete clean.answers;
  if (!includeFormSchema) delete clean.formSchema;

  for (const [key, value] of Object.entries(clean)) {
    clean[key] = escapeSpreadsheetCell(serializeValue(value));
  }

  for (const [key, value] of Object.entries(answers)) {
    clean[key] = escapeSpreadsheetCell(serializeValue(value));
  }

  return clean;
}

function objectRowsToCsv(rows) {
  const headers = [...rows.reduce((set, row) => {
    for (const key of Object.keys(row || {})) set.add(key);
    return set;
  }, new Set())];
  if (!headers.length) return '';
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((key) => escapeCsv(row?.[key])).join(','))
  ];
  return `${lines.join('\n')}\n`;
}

async function objectRowsToXlsxBuffer(rows, sheetName = 'Export') {
  if (!ExcelJS) throw new HttpError(503, 'Spreadsheet export support is unavailable. Install exceljs in the backend runtime.');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = [...rows.reduce((set, row) => {
    for (const key of Object.keys(row || {})) set.add(key);
    return set;
  }, new Set())];
  if (headers.length) {
    worksheet.addRow(headers);
    for (const row of rows) worksheet.addRow(headers.map((key) => row?.[key] ?? ''));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function serializeValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function escapeSpreadsheetCell(value) {
  if (value == null) return '';
  const str = String(value);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
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

function requireAuthReady() {
  if (!authReady || !admin) {
    throw new HttpError(503, `Backend Firebase Admin is not configured. ${firebaseInitState.message}`);
  }
}

async function getAuthContext(req, { optional = false } = {}) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    if (optional) return null;
    throw new HttpError(401, 'You must be logged in.');
  }

  requireAuthReady();

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

async function isAdminUid(uid) {
  if (!uid) return false;
  const user = await prisma.user.findUnique({ where: { uid }, select: { role: true } });
  return user?.role === 'ADMIN';
}

async function requireAdminAuth(req) {
  const authContext = await getAuthContext(req);
  if (await isAdminUid(authContext.uid)) return authContext;
  throw new HttpError(403, 'Admin access required.');
}

function readRawBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new HttpError(413, 'Upload is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => reject(new HttpError(400, 'Could not read request body.')));
  });
}

async function readMultipartForm(req, { maxBytes } = {}) {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new HttpError(400, 'Multipart boundary is missing.');
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const bodyBuffer = await readRawBody(req, maxBytes);
  const raw = bodyBuffer.toString('latin1');
  const segments = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (let segment of segments) {
    segment = segment.replace(/^\r\n/, '').replace(/\r\n$/, '');
    if (!segment) continue;
    const separatorIndex = segment.indexOf('\r\n\r\n');
    if (separatorIndex === -1) continue;
    const headerRaw = segment.slice(0, separatorIndex);
    let contentRaw = segment.slice(separatorIndex + 4);
    if (contentRaw.endsWith('\r\n')) contentRaw = contentRaw.slice(0, -2);

    const headers = {};
    for (const line of headerRaw.split('\r\n')) {
      const headerIndex = line.indexOf(':');
      if (headerIndex === -1) continue;
      headers[line.slice(0, headerIndex).trim().toLowerCase()] = line.slice(headerIndex + 1).trim();
    }

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileNameMatch = disposition.match(/filename="([^"]*)"/i);

    if (fileNameMatch) {
      files[fieldName] = {
        filename: fileNameMatch[1],
        mimeType: headers['content-type'] || 'application/octet-stream',
        buffer: Buffer.from(contentRaw, 'latin1')
      };
    } else {
      fields[fieldName] = Buffer.from(contentRaw, 'latin1').toString('utf8');
    }
  }

  return { fields, files };
}

function safeStorageFileName(name) {
  return String(name || 'file').replace(/[^a-z0-9._-]/gi, '_');
}

function ensureSkillMarkdownFile(file, { required = true } = {}) {
  if (!file) {
    if (required) throw new HttpError(400, 'A Markdown file is required.');
    return null;
  }
  const fileName = String(file.filename || '').trim();
  if (!fileName.toLowerCase().endsWith('.md')) {
    throw new HttpError(400, 'Only .md Markdown files are allowed.');
  }
  if (!file.buffer?.length) {
    throw new HttpError(400, 'The uploaded Markdown file is empty.');
  }
  if (file.buffer.length > SKILL_MAX_FILE_SIZE) {
    throw new HttpError(400, 'The Markdown file must be 2 MB or smaller.');
  }
  return file;
}

function normalizeSkillFields(fields) {
  return {
    name: String(fields.name || '').trim(),
    phone: String(fields.phone || '').trim(),
    email: String(fields.email || '').trim(),
    category: String(fields.category || '').trim(),
    description: String(fields.description || '').trim(),
    useCase: String(fields.useCase || '').trim()
  };
}

function validateSkillFields(fields) {
  if (!fields.name) throw new HttpError(400, 'Name is required.');
  if (!fields.email) throw new HttpError(400, 'Email is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }
  if (!fields.category) throw new HttpError(400, 'Category is required.');
  if (!fields.description) throw new HttpError(400, 'Description is required.');
  if (!fields.useCase) throw new HttpError(400, 'Use case is required.');
}

async function saveSkillFile({ userId, skillId, file }) {
  const safeName = safeStorageFileName(file.filename);
  const relPath = `skills/${userId}/${skillId}/${Date.now()}-${safeName}`;
  const stored = await saveUpload(file.buffer, relPath, { mimeType: 'text/markdown' });
  return {
    fileName: file.filename,
    fileSize: stored.size,
    filePath: stored.relPath,
    fileUrl: stored.url
  };
}

async function handleProfileNewsletter(req, res) {
  const authContext = await getAuthContext(req);
  const payload = await readJson(req);
  const subscribed = payload?.subscribed !== false;
  const email = String(authContext.token.email || '').trim();

  await prisma.user.upsert({
    where: { uid: authContext.uid },
    update: { email: email || undefined, newsletterSubscribed: subscribed },
    create: {
      uid: authContext.uid,
      email: email || `${authContext.uid}@unknown.local`,
      displayName: authContext.token.name || null,
      newsletterSubscribed: subscribed
    }
  });

  if (email) {
    const subscriberId = slugify(email);
    await prisma.newsletterSubscriber.upsert({
      where: { id: subscriberId },
      update: {
        email,
        status: subscribed ? 'subscribed' : 'unsubscribed',
        userId: authContext.uid
      },
      create: {
        id: subscriberId,
        email,
        status: subscribed ? 'subscribed' : 'unsubscribed',
        userId: authContext.uid
      }
    });
  }

  sendJson(res, 200, { ok: true, subscribed });
}

async function getSchemaForKind({ kind, schemaId }) {
  if (schemaId) {
    const schema = await prisma.eventForm.findUnique({ where: { id: schemaId } });
    if (!schema && kind === 'event' && schemaId === BUILT_IN_DEFAULT_EVENT_SCHEMA.id) return BUILT_IN_DEFAULT_EVENT_SCHEMA;
    if (!schema && kind === 'nodeLead' && schemaId === BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA.id) return BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA;
    if (!schema) throw new HttpError(404, 'Form schema not found.');
    return schema;
  }

  const schema = await prisma.eventForm.findFirst({
    where: { kind, isDefault: true }
  });

  if (schema) return schema;
  if (kind === 'event') return BUILT_IN_DEFAULT_EVENT_SCHEMA;
  if (kind === 'nodeLead') return BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA;
  throw new HttpError(412, `Default ${kind} schema is missing.`);
}

async function handleCreateSkill(req, res) {
  const authContext = await getAuthContext(req);
  const { fields, files } = await readMultipartForm(req, { maxBytes: SKILL_MAX_FILE_SIZE + 64 * 1024 });
  const normalizedFields = normalizeSkillFields(fields);
  validateSkillFields(normalizedFields);
  const uploadFile = ensureSkillMarkdownFile(files.file, { required: true });

  const skillId = crypto.randomUUID();
  const upload = await saveSkillFile({
    userId: authContext.uid,
    skillId,
    file: uploadFile
  });
  const markdownContent = uploadFile.buffer.toString('utf8');

  const created = await prisma.skill.create({
    data: {
      id: skillId,
      ...normalizedFields,
      ...upload,
      markdownContent,
      userId: authContext.uid,
      publishState: 'pending',
      downloads: 0
    }
  });

  sendJson(res, 200, {
    ok: true,
    id: created.id,
    skillId: created.id,
    publishState: 'pending',
    status: 'submitted',
    message: 'Thank you. Your skill has been submitted for review.',
    subMessage: 'It is now in the approval queue. Once an admin publishes it, it will appear on the SkillDB dashboard for everyone to browse and download.'
  });
}

async function handleUpdateSkill(req, res, skillId) {
  const authContext = await getAuthContext(req);
  const existing = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!existing) throw new HttpError(404, 'Skill not found.');
  if (existing.userId !== authContext.uid) throw new HttpError(403, 'You can only edit your own submissions.');

  const { fields, files } = await readMultipartForm(req, { maxBytes: SKILL_MAX_FILE_SIZE + 64 * 1024 });
  const normalizedFields = normalizeSkillFields(fields);
  validateSkillFields(normalizedFields);
  const uploadFile = ensureSkillMarkdownFile(files.file, { required: false });

  let upload = {};
  let markdownContent;
  if (uploadFile) {
    if (existing.filePath) await deleteUpload(existing.filePath);
    upload = await saveSkillFile({
      userId: authContext.uid,
      skillId,
      file: uploadFile
    });
    markdownContent = uploadFile.buffer.toString('utf8');
  }

  await prisma.skill.update({
    where: { id: skillId },
    data: {
      ...normalizedFields,
      ...upload,
      ...(markdownContent !== undefined ? { markdownContent } : {}),
      publishState: 'pending',
      reviewedAt: null,
      reviewedBy: null
    }
  });

  sendJson(res, 200, {
    ok: true,
    id: skillId,
    skillId,
    publishState: 'pending',
    status: 'submitted',
    message: 'Thank you. Your updated skill has been submitted for review.',
    subMessage: 'The updated version is back in the approval queue and will replace the public version after an admin publishes it.'
  });
}

async function handleDeleteSkill(req, res, skillId) {
  const authContext = await getAuthContext(req);
  const existing = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!existing) throw new HttpError(404, 'Skill not found.');
  const isAdmin = await isAdminUid(authContext.uid);
  if (!isAdmin && existing.userId !== authContext.uid) {
    throw new HttpError(403, 'You can only delete your own submissions.');
  }

  if (existing.filePath) await deleteUpload(existing.filePath);
  await prisma.skill.delete({ where: { id: skillId } });
  sendJson(res, 200, { ok: true, id: skillId });
}

async function handleReviewSkill(req, res, skillId) {
  const authContext = await requireAdminAuth(req);
  const payload = await readJson(req);
  const publishState = payload?.publishState === 'published' ? 'published' : 'pending';
  await prisma.skill.update({
    where: { id: skillId },
    data: {
      publishState,
      reviewedAt: new Date(),
      reviewedBy: authContext.uid
    }
  });
  sendJson(res, 200, { ok: true, id: skillId, publishState });
}

async function handleListSkills(req, res, url) {
  const auth = await getAuthContext(req, { optional: true });
  const isAdmin = auth ? await isAdminUid(auth.uid) : false;
  const userId = url.searchParams.get('userId');
  const adminFlag = url.searchParams.get('admin') === '1';

  let where = { publishState: 'published' };
  if (userId) {
    if (!auth || (auth.uid !== userId && !isAdmin)) {
      throw new HttpError(403, 'Not allowed.');
    }
    where = { userId };
  } else if (adminFlag) {
    if (!isAdmin) throw new HttpError(403, 'Admin access required.');
    where = {};
  }

  const skills = await prisma.skill.findMany({ where, orderBy: { createdAt: 'desc' } });
  sendJson(res, 200, { ok: true, skills });
}

async function handleGetSkill(req, res, skillId) {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) throw new HttpError(404, 'Skill not found.');
  if (skill.publishState !== 'published') {
    const auth = await getAuthContext(req, { optional: true });
    const isAdmin = auth ? await isAdminUid(auth.uid) : false;
    if (!auth || (auth.uid !== skill.userId && !isAdmin)) throw new HttpError(404, 'Skill not found.');
  }
  sendJson(res, 200, { ok: true, skill });
}

async function handleIncrementSkillDownloads(req, res, skillId) {
  const skill = await prisma.skill.update({
    where: { id: skillId },
    data: { downloads: { increment: 1 } }
  });
  sendJson(res, 200, { ok: true, downloads: skill.downloads });
}

async function countAdmins() {
  return prisma.user.count({ where: { role: 'ADMIN' } });
}

async function resolveUid({ uid, email }) {
  if (uid) return uid;
  if (email) {
    const trimmed = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: trimmed } });
    if (existing) return existing.uid;
    if (admin) {
      try {
        const userRecord = await admin.auth().getUserByEmail(trimmed);
        return userRecord.uid;
      } catch (error) {
        throw new HttpError(404, 'No user with that email exists.');
      }
    }
    throw new HttpError(404, 'No user with that email exists.');
  }
  throw new HttpError(400, 'A uid or email is required.');
}

async function setAdminState(uid, isAdmin) {
  let firebaseUser = null;
  if (admin) {
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (error) {
      // Firebase user may have been deleted; we still update Postgres.
    }
  }

  await prisma.user.upsert({
    where: { uid },
    update: { role: isAdmin ? 'ADMIN' : 'USER' },
    create: {
      uid,
      email: firebaseUser?.email || `${uid}@unknown.local`,
      displayName: firebaseUser?.displayName || null,
      role: isAdmin ? 'ADMIN' : 'USER'
    }
  });
}

async function applyBootstrapAdminIfNeeded(userRecord) {
  if (!userRecord?.email) return false;
  if (userRecord.emailVerified !== true) return false;
  const allowlist = splitEmails(process.env.BOOTSTRAP_ADMIN_EMAILS || '');
  if (!allowlist.length) return false;
  if (!allowlist.includes(String(userRecord.email).toLowerCase())) return false;
  const existing = await prisma.user.findUnique({ where: { uid: userRecord.uid } });
  if (existing?.role === 'ADMIN') return false;
  await setAdminState(userRecord.uid, true);
  return true;
}

function getSetupWarnings() {
  const warnings = [];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    warnings.push('FIREBASE_SERVICE_ACCOUNT_PATH is missing.');
  } else if (!fs.existsSync(path.resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH))) {
    warnings.push('FIREBASE_SERVICE_ACCOUNT_PATH does not point to an existing file.');
  }
  if (!process.env.DATABASE_URL) warnings.push('DATABASE_URL is missing.');
  if (!process.env.BREVO_API_KEY) warnings.push('BREVO_API_KEY is missing.');
  if (!process.env.BREVO_SENDER_EMAIL) warnings.push('BREVO_SENDER_EMAIL is missing.');
  if (splitEmails(process.env.BOOTSTRAP_ADMIN_EMAILS || '').length === 0) {
    warnings.push('BOOTSTRAP_ADMIN_EMAILS is empty.');
  }
  if (!admin) warnings.push('firebase-admin is not installed for the backend runtime.');
  if (!ExcelJS) warnings.push('exceljs is not installed, so spreadsheet imports/exports are unavailable.');
  warnings.push(...s3ConfigWarnings());
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
    database: {
      configured: Boolean(process.env.DATABASE_URL)
    },
    storage: getStorageDiagnostics(),
    warnings: getSetupWarnings()
  };
}

function getPublicDiagnostics() {
  return {
    firebaseAdmin: { status: firebaseInitState.status === 'ready' ? 'ready' : 'unavailable' },
    database: { configured: Boolean(process.env.DATABASE_URL) },
    storage: { driver: STORAGE_DRIVER }
  };
}

async function resolveUpdateDocument({ updateId, updateSlug }) {
  if (updateId) {
    const byId = await prisma.update.findUnique({ where: { id: updateId } });
    if (byId) return byId;
  }
  if (updateSlug) {
    const bySlug = await prisma.update.findUnique({ where: { slug: updateSlug } });
    if (bySlug) return bySlug;
  }
  return null;
}

function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateForDisplay(value) {
  const str = String(value || '').trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const EVENT_EXTRA_FIELDS = [
  'format',
  'dateDisplay',
  'duration',
  'startTime',
  'endTime',
  'type',
  'capacity',
  'tagline',
  'description',
  'agenda',
  'speakers',
  'status',
  'registrationMode',
  'mapEnabled'
];

function pickEventExtra(payload = {}) {
  const extra = {};
  for (const key of EVENT_EXTRA_FIELDS) {
    if (payload[key] !== undefined) extra[key] = payload[key];
  }
  return extra;
}

function normalizeEventRecord(row) {
  if (!row) return null;
  const extra = row.extra && typeof row.extra === 'object' && !Array.isArray(row.extra)
    ? row.extra
    : {};
  return {
    ...row,
    ...extra,
    extra
  };
}

function buildEventData(payload = {}) {
  const existingExtra = payload.extra && typeof payload.extra === 'object' && !Array.isArray(payload.extra)
    ? payload.extra
    : {};
  const extra = { ...existingExtra, ...pickEventExtra(payload) };
  extra.dateDisplay = payload.date ? formatDateForDisplay(payload.date) : '';
  return {
    title: payload.title || '',
    publishState: payload.publishState || 'draft',
    entry: payload.entry || 'application',
    formId: payload.formId || null,
    date: payload.date ? parseDateOnly(payload.date) : null,
    location: payload.location || null,
    mapAddress: payload.mapAddress || null,
    mapLat: payload.mapLat != null ? Number(payload.mapLat) : null,
    mapLng: payload.mapLng != null ? Number(payload.mapLng) : null,
    extra: Object.keys(extra).length ? extra : null
  };
}

function relUploadPathFromUrl(urlValue) {
  return storageKeyFromUrl(urlValue);
}

async function cleanupUpdateAttachments(attachments) {
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const relPath = relUploadPathFromUrl(attachment?.url);
    if (relPath) await deleteUpload(relPath);
  }
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

async function parseXlsxObjects(buffer) {
  if (!ExcelJS) throw new HttpError(503, 'Spreadsheet parsing support is unavailable in the backend runtime.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const rows = [];
  worksheet.eachRow((row) => {
    rows.push(row.values.slice(1).map((cell) => {
      if (cell && typeof cell === 'object' && 'text' in cell) return cell.text;
      if (cell && typeof cell === 'object' && 'result' in cell) return cell.result;
      return cell;
    }));
  });
  if (!rows.length) return [];
  const headers = rows.shift().map((item) => String(item || '').trim());
  return rows.map((row) => Object.fromEntries(headers.map((key, index) => [key, row[index] || ''])));
}

async function extractRecipientsFromUpload(upload) {
  const buffer = normalizeUploadBase64(upload);
  const name = String(upload?.name || '').toLowerCase();
  const rows = name.endsWith('.xlsx')
    ? (await parseXlsxObjects(buffer)).map((row) => Object.values(row))
    : buffer.toString('utf8').split(/\r?\n/).map((line) => line.split(','));
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
    return { text, html: textToHtml(text) };
  }

  if (extension.endsWith('.docx')) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiu-docx-'));
    const sourcePath = path.join(tempDir, upload.filename || 'upload.docx');
    fs.writeFileSync(sourcePath, buffer);
    try {
      const text = execFileSync('textutil', ['-convert', 'txt', '-stdout', sourcePath], {
        encoding: 'utf8'
      });
      return { text, html: textToHtml(text) };
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (error) { /* ignore */ }
    }
  }

  throw new HttpError(400, 'Unsupported content file. Upload .txt or .docx.');
}

async function handleEventRegistration(req, res) {
  const payload = await readJson(req);
  const authContext = await getAuthContext(req);
  const { eventId, answers, inviteToken } = payload;

  if (!eventId) throw new HttpError(400, 'Event is required.');

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, 'Event not found.');
  if (event.publishState !== 'published') {
    throw new HttpError(412, 'Event is not open for registration.');
  }
  const entryType = normalizeEntryType(event.entry);
  const schema = await getSchemaForKind({ kind: 'event', schemaId: event.formId || null });
  const { normalized, errors } = validateAnswers(schema, answers || {});
  if (Object.keys(errors).length) {
    logActivity('event_registration_validation_failed', {
      eventId,
      eventTitle: event.title,
      schemaId: schema.id,
      errorFields: Object.keys(errors),
      answerFields: Object.keys(answers || {})
    });
    throw new HttpError(400, 'Some answers need attention. Check the highlighted fields and submit again.', { errors });
  }

  const email = normalizeEmail(normalized.email || payload.email || authContext.token.email || '');
  let invite = null;
  if (entryType === 'invite-only') {
    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new HttpError(412, 'This event requires a direct invite. Use the invite link from your email to register.');
    }
    invite = await prisma.eventInvite.findUnique({ where: { token } });
    if (!invite || invite.eventId !== eventId || invite.status === 'revoked') {
      throw new HttpError(412, 'This invite link is not valid anymore. Contact the AI Unplugged team if you need help.');
    }
    if (invite.email && email && normalizeEmail(invite.email) !== email) {
      throw new HttpError(412, 'This invite is tied to a different email address. Use the invited email to register.');
    }
  }

  const registrationId = makeRegistrationId();
  const capacity = eventCapacity(event);
  const activeCount = await countActiveRegistrations(eventId);
  const capacityExceeded = capacity > 0 && activeCount >= capacity;
  const reviewStatus = capacityExceeded
    ? 'waitlisted'
    : (entryType === 'open' || entryType === 'invite-only' ? 'accepted' : 'pending');
  const waitlistMessage = 'The room is currently full, but your request is on the waitlist. We’ll let you know if we can arrange a few more seats.';
  const statusMessage = reviewStatus === 'waitlisted'
    ? waitlistMessage
    : reviewStatus === 'accepted'
      ? 'Your seat is confirmed. Check your email for the registration details.'
      : 'Your request has been received. We will review it and email you with the next update.';

  await prisma.user.upsert({
    where: { uid: authContext.uid },
    update: {
      email: authContext.token.email || email || undefined,
      displayName: authContext.token.name || normalized.name || undefined,
      newsletterSubscribed: true
    },
    create: {
      uid: authContext.uid,
      email: authContext.token.email || email || `${authContext.uid}@unknown.local`,
      displayName: authContext.token.name || normalized.name || null,
      newsletterSubscribed: true
    }
  });

  const created = await prisma.eventRegistration.create({
    data: {
      registrationId,
      eventId,
      eventTitle: event.title,
      entryType,
      formId: schema.id,
      formTitle: schema.title,
      formSchema: buildFormSchemaSnapshot(schema),
      answers: normalized,
      reviewStatus,
      waitlistReason: capacityExceeded ? 'capacity_exceeded' : null,
      inviteId: invite?.id || null,
      source: invite ? 'invite' : 'member',
      userId: authContext.uid,
      name: normalized.name || payload.name || '',
      email,
      organization: normalized.organization || '',
      subscribedToNewsletter: true
    }
  });

  if (invite) {
    await prisma.eventInvite.update({
      where: { id: invite.id },
      data: {
        status: reviewStatus === 'waitlisted' ? 'waitlisted' : 'accepted',
        acceptedAt: reviewStatus === 'waitlisted' ? null : new Date()
      }
    });
  }

  if (email) {
    const subscriberId = slugify(email);
    await prisma.newsletterSubscriber.upsert({
      where: { id: subscriberId },
      update: { email, status: 'subscribed', userId: authContext.uid, source: 'registration-member' },
      create: { id: subscriberId, email, status: 'subscribed', userId: authContext.uid, source: 'registration-member' }
    });

    try {
      const safeTitle = escapeHtml(event.title || '');
      const safeId = escapeHtml(registrationId);
      const detailsNote = 'We will share event-specific details closer to the session if needed.';
      const isConfirmed = reviewStatus === 'accepted';
      const isWaitlisted = reviewStatus === 'waitlisted';
      const subject = isConfirmed
        ? `Registration confirmed: ${event.title}`
        : isWaitlisted
          ? `Waitlist request received: ${event.title}`
          : `Registration received: ${event.title}`;
      const html = isConfirmed
        ? `<p>Your registration for <strong>${safeTitle}</strong> is confirmed.</p><p>Your registration ID is <strong>${safeId}</strong>.</p><p>${escapeHtml(detailsNote)}</p>`
        : isWaitlisted
          ? `<p>Your request for <strong>${safeTitle}</strong> is on the waitlist.</p><p>Your registration ID is <strong>${safeId}</strong>.</p><p>${escapeHtml(waitlistMessage)}</p><p>${escapeHtml(detailsNote)}</p>`
          : `<p>Your registration for <strong>${safeTitle}</strong> has been received.</p><p>Your registration ID is <strong>${safeId}</strong>.</p><p>We will review your request and email you with the next update.</p><p>${escapeHtml(detailsNote)}</p>`;
      const text = isConfirmed
        ? `Your registration for ${event.title} is confirmed. Registration ID: ${registrationId}\n${detailsNote}`
        : isWaitlisted
          ? `Your request for ${event.title} is on the waitlist. Registration ID: ${registrationId}\n${waitlistMessage}\n${detailsNote}`
          : `Your registration for ${event.title} has been received. Registration ID: ${registrationId}\nWe will review your request and email you with the next update.\n${detailsNote}`;
      await mailProvider.sendTransactionalEmail({ to: email, subject, html, text });
    } catch (error) {
      console.error('Registration email failed:', error.message);
      logError('event_registration_email_failed', error, {
        eventId,
        registrationId,
        email,
        reviewStatus
      });
    }
  }

  logActivity('event_registration_created', {
    eventId,
    eventTitle: event.title,
    registrationId,
    entryType,
    reviewStatus: created.reviewStatus,
    userId: authContext.uid,
    email,
    capacity,
    activeCountBeforeSubmission: activeCount
  });

  sendJson(res, 200, { ok: true, id: created.id, registrationId, entryType, reviewStatus: created.reviewStatus, message: statusMessage });
}

async function handleNodeLeadApplication(req, res) {
  const payload = await readJson(req);
  const authContext = await getAuthContext(req, { optional: true });
  const schema = await getSchemaForKind({ kind: 'nodeLead', schemaId: payload.schemaId || null });
  const { normalized, errors } = validateAnswers(schema, payload.answers || {});

  if (Object.keys(errors).length) {
    logActivity('node_lead_validation_failed', {
      schemaId: schema.id,
      errorFields: Object.keys(errors),
      answerFields: Object.keys(payload.answers || {})
    });
    throw new HttpError(400, 'Some answers need attention. Check the highlighted fields and submit again.', { errors });
  }

  const created = await prisma.nodeLeadApplication.create({
    data: {
      formId: schema.id,
      formTitle: schema.title,
      formSchema: buildFormSchemaSnapshot(schema),
      answers: normalized,
      email: normalized.email || '',
      name: normalized.name || '',
      reviewStatus: 'pending',
      userId: authContext ? authContext.uid : null
    }
  });

  logActivity('node_lead_application_created', {
    id: created.id,
    schemaId: schema.id,
    email: normalized.email || '',
    userId: authContext ? authContext.uid : null
  });

  sendJson(res, 200, { ok: true, id: created.id });
}

async function handleHostApplication(req, res) {
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
    logActivity('host_application_validation_failed', {
      errorFields: Object.keys(errors),
      answerFields: Object.keys(answers || {})
    });
    throw new HttpError(400, 'Some answers need attention. Check the highlighted fields and submit again.', { errors });
  }

  const email = String(answers.email || '').trim();
  const cleanAnswers = {
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
  };

  const created = await prisma.hostApplication.create({
    data: {
      answers: cleanAnswers,
      name: cleanAnswers.name,
      email,
      countryCode: cleanAnswers.countryCode,
      phone: cleanAnswers.phone,
      subject: cleanAnswers.subject,
      venue: cleanAnswers.venue,
      venueCapacity: Number.isFinite(cleanAnswers.venueCapacity) ? cleanAnswers.venueCapacity : null,
      estimatedAudience: Number.isFinite(cleanAnswers.estimatedAudience) ? cleanAnswers.estimatedAudience : null,
      reviewStatus: 'pending'
    }
  });

  logActivity('host_application_created', {
    id: created.id,
    email,
    venue: cleanAnswers.venue,
    reviewStatus: created.reviewStatus
  });

  sendJson(res, 200, { ok: true, id: created.id });
}

async function handleUpdateComment(req, res) {
  const authContext = await getAuthContext(req);
  const payload = await readJson(req);
  const { updateId, updateSlug, body } = payload;

  if ((!updateId && !updateSlug) || !String(body || '').trim()) {
    throw new HttpError(400, 'Update and comment body are required.');
  }

  const update = await resolveUpdateDocument({ updateId, updateSlug });
  if (!update) throw new HttpError(404, 'Update not found.');
  if (update.publishState !== 'published') {
    throw new HttpError(412, 'Update is not available.');
  }
  if (update.commentMode === 'disabled') {
    throw new HttpError(412, 'Comments are disabled for this post.');
  }

  const status = update.commentMode === 'moderated' ? 'pending' : 'approved';
  const created = await prisma.comment.create({
    data: {
      updateId: update.id,
      updateSlug: update.slug,
      body: String(body).trim(),
      status,
      userId: authContext.uid,
      authorName: authContext.token.name || authContext.token.email || 'Member',
      authorEmail: authContext.token.email || ''
    }
  });

  sendJson(res, 200, { ok: true, id: created.id, status });
}

async function handleListComments(req, res, url) {
  const updateId = url.searchParams.get('updateId');
  if (!updateId) throw new HttpError(400, 'updateId is required.');
  const auth = await getAuthContext(req, { optional: true });
  const includePending = url.searchParams.get('all') === '1';
  const isAdmin = auth ? await isAdminUid(auth.uid) : false;

  const where = { updateId };
  if (!isAdmin || !includePending) where.status = 'approved';

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
  sendJson(res, 200, { ok: true, comments });
}

async function handleAdminListComments(req, res) {
  await requireAdminAuth(req);
  const comments = await prisma.comment.findMany({ orderBy: { createdAt: 'desc' } });
  sendJson(res, 200, { ok: true, comments });
}

async function handleUpdateCommentStatus(req, res, commentId) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const status = payload?.status === 'approved' ? 'approved' : 'pending';
  await prisma.comment.update({ where: { id: commentId }, data: { status } });
  sendJson(res, 200, { ok: true, id: commentId, status });
}

async function handleDeleteComment(req, res, commentId) {
  await requireAdminAuth(req);
  await prisma.comment.delete({ where: { id: commentId } });
  sendJson(res, 200, { ok: true, id: commentId });
}

async function handleExport(req, res) {
  await requireAdminAuth(req);

  const payload = await readJson(req);
  const allowedDatasets = new Set(['eventRegistrations', 'nodeLeadApplications', 'hostApplications']);
  const dataset = allowedDatasets.has(payload.dataset) ? payload.dataset : 'eventRegistrations';
  const format = payload.format || 'csv';

  let rows;
  if (dataset === 'eventRegistrations') {
    const where = payload.eventId ? { eventId: payload.eventId } : {};
    rows = await prisma.eventRegistration.findMany({ where, orderBy: { createdAt: 'desc' } });
  } else if (dataset === 'nodeLeadApplications') {
    rows = await prisma.nodeLeadApplication.findMany({ orderBy: { createdAt: 'desc' } });
  } else {
    rows = await prisma.hostApplication.findMany({ orderBy: { createdAt: 'desc' } });
  }

  if (format === 'json') {
    sendJson(res, 200, {
      ok: true,
      filename: `${dataset}.json`,
      mimeType: 'application/json',
      base64: Buffer.from(JSON.stringify(rows.map((row) => flattenRow(row, { includeFormSchema: true })), null, 2)).toString('base64')
    });
    return;
  }

  const flatRows = rows.map((row) => flattenRow(row, { includeFormSchema: false }));

  if (format === 'xlsx') {
    const buffer = await objectRowsToXlsxBuffer(flatRows, 'Export');
    sendJson(res, 200, {
      ok: true,
      filename: `${dataset}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(buffer).toString('base64')
    });
    return;
  }

  const csv = objectRowsToCsv(flatRows);
  sendJson(res, 200, {
    ok: true,
    filename: `${dataset}.csv`,
    mimeType: 'text/csv',
    base64: Buffer.from(csv).toString('base64')
  });
}

async function handleNewsletterCampaign(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const { subject, html, text, recipientsUpload } = payload;

  if (!subject || !html) {
    throw new HttpError(400, 'Subject and HTML content are required.');
  }

  let recipients = [];
  if (recipientsUpload?.base64) {
    recipients = (await extractRecipientsFromUpload(recipientsUpload)).slice(0, 300);
  } else {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { status: 'subscribed' },
      select: { email: true }
    });
    recipients = subscribers.map((row) => row.email).filter(Boolean).slice(0, 300);
  }

  if (!recipients.length) {
    sendJson(res, 200, { ok: true, sent: 0 });
    return;
  }

  await mailProvider.sendCampaignEmail({ recipients, subject, html, text });

  await prisma.newsletterCampaign.create({
    data: {
      subject,
      html,
      text: text || '',
      recipients: recipients.length,
      status: 'sent'
    }
  });

  sendJson(res, 200, { ok: true, sent: recipients.length });
}

async function handleDashboardData(req, res) {
  const authContext = await getAuthContext(req);

  const [registrations, updatesAll] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { userId: authContext.uid },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.update.findMany({
      where: { publishState: 'published' },
      orderBy: { publishedAt: 'desc' }
    })
  ]);

  const eventIds = new Set(registrations.map((item) => item.eventId).filter(Boolean));
  const recentUpdates = updatesAll.slice(0, 3);
  const missed = updatesAll.filter((item) => item.category === 'event-recap' || item.scope === 'event').slice(0, 3);
  const eventUpdates = updatesAll.filter((item) => item.eventId && eventIds.has(item.eventId)).slice(0, 3);

  sendJson(res, 200, {
    ok: true,
    registrations,
    recentUpdates,
    missed,
    eventUpdates
  });
}

async function handleSyncCurrentUser(req, res) {
  const authContext = await getAuthContext(req);
  let userRecord = null;
  if (admin) {
    try {
      userRecord = await admin.auth().getUser(authContext.uid);
    } catch (error) {
      // fall back to token
    }
  }
  const email = userRecord?.email || authContext.token.email || '';
  const displayName = userRecord?.displayName || authContext.token.name || '';

  await prisma.user.upsert({
    where: { uid: authContext.uid },
    update: { email: email || undefined, displayName: displayName || undefined },
    create: {
      uid: authContext.uid,
      email: email || `${authContext.uid}@unknown.local`,
      displayName: displayName || null,
      newsletterSubscribed: true
    }
  });

  const bootstrapApplied = await applyBootstrapAdminIfNeeded(
    userRecord || {
      uid: authContext.uid,
      email,
      emailVerified: authContext.token.email_verified === true
    }
  );
  const profile = await prisma.user.findUnique({ where: { uid: authContext.uid } });

  sendJson(res, 200, {
    ok: true,
    profile: profile ? {
      id: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role.toLowerCase(),
      newsletterSubscribed: profile.newsletterSubscribed,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    } : null,
    claimsUpdated: bootstrapApplied,
    setupWarnings: getSetupWarnings()
  });
}

async function handleListAdmins(req, res) {
  await requireAdminAuth(req);
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  sendJson(res, 200, {
    ok: true,
    admins: admins.map((row) => ({
      id: row.uid,
      uid: row.uid,
      email: row.email,
      displayName: row.displayName,
      role: row.role.toLowerCase(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  });
}

async function handleGrantAdmin(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const targetUid = await resolveUid(payload || {});
  await setAdminState(targetUid, true);
  sendJson(res, 200, { ok: true, uid: targetUid });
}

async function handleRevokeAdmin(req, res) {
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
  const authContext = await requireAdminAuth(req);
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new HttpError(412, 'You must assign another admin before removing your own admin access.');
  }
  await setAdminState(authContext.uid, false);
  sendJson(res, 200, { ok: true, uid: authContext.uid });
}

async function handleSetupStatus(req, res) {
  // Detailed diagnostics are admin-only. Public callers get a minimal response.
  const auth = await getAuthContext(req, { optional: true });
  const isAdmin = auth ? await isAdminUid(auth.uid) : false;
  if (!isAdmin) {
    sendJson(res, 200, {
      ok: true,
      version: SERVER_VERSION,
      capabilities: getServerCapabilities()
    });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    mailProvider: mailProvider.providerName,
    warnings: getSetupWarnings(),
    diagnostics: getSetupDiagnostics(),
    version: SERVER_VERSION,
    capabilities: getServerCapabilities()
  });
}

async function handleGeocode(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const result = await geocodeAddress(payload?.address || '');
  sendJson(res, 200, { ok: true, ...result });
}

async function handleImportContent(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const result = importContentText(payload.upload || {});
  sendJson(res, 200, { ok: true, ...result });
}

async function handleSaveUpdate(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const scope = payload.scope === 'event' ? 'event' : 'general';

  let eventTitle = '';
  if (scope === 'event') {
    if (!payload.eventId) throw new HttpError(400, 'Event-specific updates require an event.');
    const event = await prisma.event.findUnique({ where: { id: payload.eventId } });
    if (!event) throw new HttpError(404, 'Selected event not found.');
    eventTitle = event.title || '';
  }

  const data = {
    title: payload.title || '',
    slug: slugify(payload.slug || payload.title || crypto.randomUUID()),
    excerpt: payload.excerpt || '',
    body: Array.isArray(payload.body) ? payload.body : htmlToParagraphs(payload.bodyHtml || ''),
    bodyHtml: payload.bodyHtml || '',
    category: payload.category || 'update',
    commentMode: payload.commentMode || 'moderated',
    publishState: payload.publishState || 'draft',
    authorName: payload.authorName || 'AI Unplugged Team',
    scope,
    eventId: scope === 'event' ? payload.eventId : null,
    eventTitle,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : []
  };

  if (data.publishState === 'published') {
    data.publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : new Date();
  }

  let saved;
  if (payload.id) {
    saved = await prisma.update.upsert({
      where: { id: payload.id },
      update: data,
      create: { id: payload.id, ...data }
    });
  } else {
    saved = await prisma.update.create({ data });
  }

  if (scope === 'event' && data.publishState === 'published') {
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: payload.eventId },
      select: { email: true }
    });
    const recipients = registrations.map((row) => row.email).filter(Boolean).slice(0, 300);
    if (recipients.length) {
      await mailProvider.sendCampaignEmail({
        recipients,
        subject: payload.title,
        html: payload.bodyHtml || textToHtml((Array.isArray(data.body) ? data.body : []).join('\n\n')),
        text: (Array.isArray(data.body) ? data.body : []).join('\n\n')
      });
    }
  }

  sendJson(res, 200, { ok: true, id: saved.id, update: normalizeUpdateResponse(saved) });
}

async function handleDeleteUpdate(req, res, updateId) {
  await requireAdminAuth(req);
  const existing = await prisma.update.findUnique({ where: { id: updateId } });
  if (!existing) throw new HttpError(404, 'Update not found.');
  await prisma.update.delete({ where: { id: updateId } });
  try {
    await cleanupUpdateAttachments(existing.attachments);
  } catch (error) {
    console.error('Update attachment cleanup failed:', error.message);
  }
  sendJson(res, 200, { ok: true, id: updateId });
}

async function handleListEvents(req, res, url) {
  const slug = url.searchParams.get('slug');
  const adminFlag = url.searchParams.get('admin') === '1';
  let where = { publishState: 'published' };
  if (adminFlag) {
    await requireAdminAuth(req);
    where = {};
  }
  if (slug) where = { ...where, id: slug };
  const events = await prisma.event.findMany({ where, orderBy: { date: 'asc' } });
  sendJson(res, 200, { ok: true, events: events.map(normalizeEventRecord) });
}

async function handleGetEvent(req, res, eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, 'Event not found.');
  if (event.publishState !== 'published') {
    const auth = await getAuthContext(req, { optional: true });
    const isAdmin = auth ? await isAdminUid(auth.uid) : false;
    if (!isAdmin) throw new HttpError(404, 'Event not found.');
  }
  sendJson(res, 200, { ok: true, event: normalizeEventRecord(event) });
}

async function handleSaveEvent(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const { id } = payload;
  const data = buildEventData(payload);

  let saved;
  if (id) {
    saved = await prisma.event.upsert({
      where: { id },
      update: data,
      create: { id, ...data }
    });
  } else {
    saved = await prisma.event.create({ data });
  }
  sendJson(res, 200, { ok: true, id: saved.id, event: normalizeEventRecord(saved) });
}

async function handleDeleteEvent(req, res, eventId) {
  await requireAdminAuth(req);
  const registrationCount = await prisma.eventRegistration.count({ where: { eventId } });
  if (registrationCount > 0) {
    throw new HttpError(409, 'Cannot delete an event that already has registrations.');
  }
  try {
    await prisma.event.delete({ where: { id: eventId } });
  } catch (error) {
    if (error?.code === 'P2025') throw new HttpError(404, 'Event not found.');
    throw error;
  }
  sendJson(res, 200, { ok: true, id: eventId });
}

async function handleListUpdates(req, res, url) {
  const adminFlag = url.searchParams.get('admin') === '1';
  let where = { publishState: 'published' };
  if (adminFlag) {
    await requireAdminAuth(req);
    where = {};
  }
  const slug = url.searchParams.get('slug');
  if (slug) where = { ...where, slug };
  const updates = await prisma.update.findMany({ where, orderBy: { publishedAt: 'desc' } });
  sendJson(res, 200, { ok: true, updates: updates.map(normalizeUpdateResponse) });
}

async function findUpdateBySafeSlug(slug) {
  const safeSlug = slugify(slug);
  if (!safeSlug) return null;

  const exact = await prisma.update.findUnique({ where: { slug: safeSlug } });
  if (exact) return exact;

  const candidates = await prisma.update.findMany({ orderBy: { updatedAt: 'desc' } });
  const matches = candidates.filter((item) => slugify(item.slug) === safeSlug);
  if (matches.length > 1) {
    throw new HttpError(409, 'Multiple updates match this route. Ask an admin to repair duplicate slugs.');
  }
  return matches[0] || null;
}

async function handleGetUpdate(req, res, slug) {
  const update = await findUpdateBySafeSlug(slug);
  if (!update) throw new HttpError(404, 'Update not found.');
  if (update.publishState !== 'published') {
    const auth = await getAuthContext(req, { optional: true });
    const isAdmin = auth ? await isAdminUid(auth.uid) : false;
    if (!isAdmin) throw new HttpError(404, 'Update not found.');
  }
  sendJson(res, 200, { ok: true, update: normalizeUpdateResponse(update) });
}

async function handleListResources(req, res, url) {
  const adminFlag = url.searchParams.get('admin') === '1';
  let where = { publishState: 'published' };
  if (adminFlag) {
    await requireAdminAuth(req);
    where = {};
  }
  const slug = url.searchParams.get('slug');
  if (slug) where = { ...where, slug };
  const resources = await prisma.resource.findMany({ where, orderBy: { updatedAt: 'desc' } });
  sendJson(res, 200, { ok: true, resources: resources.map(normalizeResourceResponse) });
}

async function findResourceBySafeSlug(slug) {
  const safeSlug = slugify(slug);
  if (!safeSlug) return null;

  const exact = await prisma.resource.findUnique({ where: { slug: safeSlug } });
  if (exact) return exact;

  const candidates = await prisma.resource.findMany({ orderBy: { updatedAt: 'desc' } });
  const matches = candidates.filter((item) => slugify(item.slug) === safeSlug);
  if (matches.length > 1) {
    throw new HttpError(409, 'Multiple resources match this route. Ask an admin to repair duplicate slugs.');
  }
  return matches[0] || null;
}

async function handleGetResource(req, res, slug) {
  const resource = await findResourceBySafeSlug(slug);
  if (!resource) throw new HttpError(404, 'Resource not found.');
  if (resource.publishState !== 'published') {
    const auth = await getAuthContext(req, { optional: true });
    const isAdmin = auth ? await isAdminUid(auth.uid) : false;
    if (!isAdmin) throw new HttpError(404, 'Resource not found.');
  }
  sendJson(res, 200, { ok: true, resource: normalizeResourceResponse(resource) });
}

async function handleSaveResource(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const { id, createdAt, updatedAt, ...rest } = payload;

  const slug = slugify(rest.slug || rest.title || id || crypto.randomUUID());
  const data = {
    title: rest.title || 'Untitled Resource',
    slug,
    sourceLabel: rest.sourceLabel || null,
    excerpt: rest.excerpt || null,
    body: Array.isArray(rest.body) ? rest.body : null,
    bodyHtml: rest.bodyHtml || null,
    ctaLabel: rest.ctaLabel || null,
    ctaUrl: rest.ctaUrl || null,
    image: rest.image || null,
    publishState: rest.publishState || 'draft'
  };

  let saved;
  if (id) {
    saved = await prisma.resource.upsert({
      where: { id },
      update: data,
      create: { id, ...data }
    });
  } else {
    saved = await prisma.resource.create({ data });
  }
  sendJson(res, 200, { ok: true, id: saved.id, resource: normalizeResourceResponse(saved) });
}

async function handleDeleteResource(req, res, resourceId) {
  await requireAdminAuth(req);
  await prisma.resource.delete({ where: { id: resourceId } });
  sendJson(res, 200, { ok: true, id: resourceId });
}

async function handleListEventForms(req, res, url) {
  const kind = url.searchParams.get('kind');
  const where = kind ? { kind } : {};
  const forms = await prisma.eventForm.findMany({ where, orderBy: { updatedAt: 'desc' } });
  sendJson(res, 200, { ok: true, forms });
}

async function handleGetEventForm(req, res, formId) {
  const form = await prisma.eventForm.findUnique({ where: { id: formId } });
  if (!form && formId === BUILT_IN_DEFAULT_EVENT_SCHEMA.id) {
    sendJson(res, 200, { ok: true, form: BUILT_IN_DEFAULT_EVENT_SCHEMA });
    return;
  }
  if (!form && formId === BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA.id) {
    sendJson(res, 200, { ok: true, form: BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA });
    return;
  }
  if (!form) throw new HttpError(404, 'Form not found.');
  sendJson(res, 200, { ok: true, form });
}

async function handleSaveEventForm(req, res) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const { id, createdAt, updatedAt, ...rest } = payload;
  const data = {
    kind: rest.kind || 'event',
    isDefault: Boolean(rest.isDefault),
    title: rest.title || 'Untitled form',
    fields: normalizeFormFields(rest.fields || [])
  };
  let saved;
  if (id) {
    saved = await prisma.eventForm.upsert({
      where: { id },
      update: data,
      create: { id, ...data }
    });
  } else {
    saved = await prisma.eventForm.create({ data });
  }
  sendJson(res, 200, { ok: true, id: saved.id, form: saved });
}

async function handleSiteSettings(req, res, key) {
  if (req.method === 'GET') {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    sendJson(res, 200, { ok: true, key, value: row?.value || null });
    return;
  }
  if (req.method === 'PUT') {
    await requireAdminAuth(req);
    const payload = await readJson(req);
    const value = payload?.value ?? {};
    const saved = await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    sendJson(res, 200, { ok: true, key, value: saved.value });
    return;
  }
  throw new HttpError(405, 'Method not allowed.');
}

async function handleListEventRegistrations(req, res, url) {
  await requireAdminAuth(req);
  const eventId = url.searchParams.get('eventId');
  const where = eventId ? { eventId } : {};
  const registrations = await prisma.eventRegistration.findMany({ where, orderBy: { createdAt: 'desc' } });
  sendJson(res, 200, { ok: true, registrations });
}

function parseCsvRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((key, index) => [key, values[index] || '']));
  });
}

async function parseInviteUpload(upload) {
  if (!upload?.base64) return [];
  const name = String(upload.name || '').toLowerCase();
  const buffer = Buffer.from(upload.base64, 'base64');
  if (name.endsWith('.xlsx')) {
    return parseXlsxObjects(buffer);
  }
  if (name.endsWith('.xls')) {
    throw new HttpError(415, 'Legacy .xls files are not supported. Upload CSV or XLSX.');
  }
  return parseCsvRows(buffer.toString('utf8'));
}

async function upsertEventInvite(eventId, row) {
  const email = normalizeEmail(row.email || row.Email || row['email address'] || row['Email Address']);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = String(row.name || row.Name || row.fullName || row['Full name'] || '').trim();
  return prisma.eventInvite.upsert({
    where: { eventId_email: { eventId, email } },
    update: { name: name || undefined, status: 'pending' },
    create: { eventId, email, name: name || null, token: makeInviteToken(), status: 'pending' }
  });
}

async function handleEventInvites(req, res, eventId, action = '') {
  await requireAdminAuth(req);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, 'Event not found.');

  if (req.method === 'GET') {
    const invites = await prisma.eventInvite.findMany({ where: { eventId }, orderBy: { invitedAt: 'desc' } });
    sendJson(res, 200, { ok: true, invites });
    return;
  }

  const payload = await readJson(req);
  if (req.method === 'POST' && action === 'import') {
    const rows = await parseInviteUpload(payload.upload || {});
    const invites = [];
    for (const row of rows) {
      const invite = await upsertEventInvite(eventId, row);
      if (invite) invites.push(invite);
    }
    sendJson(res, 200, { ok: true, invites, imported: invites.length });
    return;
  }

  if (req.method === 'POST' && action === 'send') {
    const ids = Array.isArray(payload.ids) ? payload.ids : [];
    const where = ids.length ? { eventId, id: { in: ids } } : { eventId, status: { not: 'revoked' } };
    const invites = await prisma.eventInvite.findMany({ where });
    let sent = 0;
    for (const invite of invites) {
      await sendInviteEmail(req, invite, event);
      await prisma.eventInvite.update({ where: { id: invite.id }, data: { status: 'sent', invitedAt: new Date() } });
      sent += 1;
    }
    sendJson(res, 200, { ok: true, sent });
    return;
  }

  if (req.method === 'POST') {
    const invite = await upsertEventInvite(eventId, payload || {});
    if (!invite) throw new HttpError(400, 'A valid invite email is required.');
    sendJson(res, 200, { ok: true, invite });
    return;
  }

  if (req.method === 'DELETE') {
    const inviteId = String(payload?.id || action || '').trim();
    if (!inviteId) throw new HttpError(400, 'Invite id is required.');
    await prisma.eventInvite.update({ where: { id: inviteId }, data: { status: 'revoked' } });
    sendJson(res, 200, { ok: true, id: inviteId });
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleListNodeLeadApplications(req, res) {
  await requireAdminAuth(req);
  const applications = await prisma.nodeLeadApplication.findMany({ orderBy: { createdAt: 'desc' } });
  sendJson(res, 200, { ok: true, applications });
}

async function handleListHostApplications(req, res) {
  await requireAdminAuth(req);
  const applications = await prisma.hostApplication.findMany({ orderBy: { createdAt: 'desc' } });
  sendJson(res, 200, { ok: true, applications });
}

async function handleListErrorLogs(req, res) {
  await requireAdminAuth(req);
  const logs = await prisma.appErrorLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  sendJson(res, 200, { ok: true, logs });
}

async function handleUpdateReviewStatus(req, res, dataset, recordId) {
  await requireAdminAuth(req);
  const payload = await readJson(req);
  const reviewStatus = String(payload?.reviewStatus || 'pending');
  if (dataset === 'eventRegistrations') {
    const existing = await prisma.eventRegistration.findUnique({ where: { id: recordId } });
    if (!existing) throw new HttpError(404, 'Registration not found.');
    if (reviewStatus === 'accepted' && !payload?.overrideCapacity) {
      const eventRow = await prisma.event.findUnique({ where: { id: existing.eventId } });
      const capacity = eventCapacity(eventRow);
      if (capacity > 0) {
        const activeCount = await countActiveRegistrations(existing.eventId);
        if (activeCount >= capacity && existing.reviewStatus !== 'accepted') {
          throw new HttpError(409, 'This event is already at capacity. Increase capacity or use an override to accept this registration.');
        }
      }
    }
    const updated = await prisma.eventRegistration.update({ where: { id: recordId }, data: { reviewStatus } });
    const shouldSendApprovalEmail = existing.reviewStatus !== 'accepted' && reviewStatus === 'accepted';
    if (shouldSendApprovalEmail && updated.email) {
      try {
        const eventRow = await prisma.event.findUnique({ where: { id: updated.eventId } });
        const mail = buildEventApprovalEmail({
          registration: updated,
          event: normalizeEventRecord(eventRow)
        });
        await mailProvider.sendTransactionalEmail({
          to: updated.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text
        });
      } catch (error) {
        console.error('Registration approval email failed:', error.message);
      }
    }
  } else if (dataset === 'nodeLeadApplications') {
    await prisma.nodeLeadApplication.update({ where: { id: recordId }, data: { reviewStatus } });
  } else if (dataset === 'hostApplications') {
    await prisma.hostApplication.update({ where: { id: recordId }, data: { reviewStatus } });
  } else {
    throw new HttpError(400, 'Unknown dataset.');
  }
  sendJson(res, 200, { ok: true, id: recordId, reviewStatus });
}

async function handleListSubscribers(req, res) {
  await requireAdminAuth(req);
  const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { updatedAt: 'desc' } });
  sendJson(res, 200, { ok: true, subscribers });
}

async function handleUploadFile(req, res, kind) {
  const authContext = await getAuthContext(req);
  if (!['update-attachment', 'resource-image'].includes(kind)) {
    throw new HttpError(400, 'Unknown upload kind.');
  }
  const isAdmin = await isAdminUid(authContext.uid);
  if (!isAdmin) throw new HttpError(403, 'Admin access required.');

  const { fields, files } = await readMultipartForm(req, { maxBytes: ATTACHMENT_MAX_FILE_SIZE + 64 * 1024 });
  const file = files.file;
  if (!file?.buffer?.length) throw new HttpError(400, 'A file is required.');
  if (file.buffer.length > ATTACHMENT_MAX_FILE_SIZE) {
    throw new HttpError(413, 'File is too large.');
  }
  const allowed = kind === 'resource-image' ? ALLOWED_RESOURCE_IMAGE_MIME : ALLOWED_ATTACHMENT_MIME;
  const declaredMime = String(file.mimeType || '').toLowerCase().split(';')[0].trim();
  if (!allowed.has(declaredMime)) {
    throw new HttpError(415, `Unsupported file type (${declaredMime || 'unknown'}).`);
  }
  const draftId = String(fields.draftId || 'draft').replace(/[^a-z0-9._-]/gi, '_');
  const safeName = `${Date.now()}-${safeStorageFileName(file.filename)}`;
  const folder = kind === 'update-attachment'
    ? `updates/${draftId}/attachments`
    : `resources/${draftId}/media`;
  const stored = await saveUpload(file.buffer, `${folder}/${safeName}`, { mimeType: declaredMime });

  if (kind === 'update-attachment') {
    sendJson(res, 200, {
      ok: true,
      id: safeName,
      name: file.filename,
      mimeType: file.mimeType,
      size: stored.size,
      url: stored.url,
      downloadable: true
    });
  } else {
    sendJson(res, 200, {
      ok: true,
      url: stored.url,
      name: file.filename,
      mimeType: file.mimeType,
      size: stored.size
    });
  }
}

ensureDataStore();
ensureUploadDir();

console.info(
  `[AIU backend] boot version=${SERVER_VERSION} firebase=${firebaseInitState.status} db=${process.env.DATABASE_URL ? 'configured' : 'missing'}`
);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  applySecurityHeaders(res);

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
    enforceRateLimit(req, url);

    if (url.pathname.startsWith('/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const target = resolveServePath(url.pathname);
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const isInlineSafe = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.md', '.txt'].includes(ext);
      sendFile(res, target, {
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': isInlineSafe ? 'inline' : 'attachment'
      });
      return;
    }

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
      await handleEventRegistration(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/node-leads') {
      await handleNodeLeadApplication(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/hosts') {
      await handleHostApplication(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/comments') {
      await handleUpdateComment(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/comments') {
      await handleListComments(req, res, url); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/admin/comments') {
      await handleAdminListComments(req, res); return;
    }
    const commentMatch = url.pathname.match(/^\/api\/platform\/comments\/([^/]+)$/);
    if (commentMatch && req.method === 'PUT') {
      await handleUpdateCommentStatus(req, res, decodeURIComponent(commentMatch[1])); return;
    }
    if (commentMatch && req.method === 'DELETE') {
      await handleDeleteComment(req, res, decodeURIComponent(commentMatch[1])); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/profile/newsletter') {
      await handleProfileNewsletter(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/health') {
      sendJson(res, 200, {
        ok: true,
        version: SERVER_VERSION,
        diagnostics: getPublicDiagnostics(),
        capabilities: getServerCapabilities()
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/exports') {
      await handleExport(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/newsletter') {
      await handleNewsletterCampaign(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/import-content') {
      await handleImportContent(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/auth/sync') {
      await handleSyncCurrentUser(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/dashboard') {
      await handleDashboardData(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/admins') {
      await handleListAdmins(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/admins/grant') {
      await handleGrantAdmin(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/admins/revoke') {
      await handleRevokeAdmin(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/admins/leave') {
      await handleLeaveAdmin(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/setup-status') {
      await handleSetupStatus(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/geocode') {
      await handleGeocode(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/updates') {
      await handleSaveUpdate(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/updates') {
      await handleListUpdates(req, res, url); return;
    }
    const updateByIdMatch = url.pathname.match(/^\/api\/platform\/updates\/id\/([^/]+)$/);
    if (updateByIdMatch && req.method === 'DELETE') {
      await handleDeleteUpdate(req, res, decodeURIComponent(updateByIdMatch[1])); return;
    }
    const updateBySlugMatch = url.pathname.match(/^\/api\/platform\/updates\/([^/]+)$/);
    if (updateBySlugMatch && req.method === 'GET') {
      await handleGetUpdate(req, res, decodeURIComponent(updateBySlugMatch[1])); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/events') {
      await handleListEvents(req, res, url); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/events') {
      await handleSaveEvent(req, res); return;
    }
    const eventInviteMatch = url.pathname.match(/^\/api\/platform\/events\/([^/]+)\/invites(?:\/([^/]+))?$/);
    if (eventInviteMatch && ['GET', 'POST', 'DELETE'].includes(req.method)) {
      await handleEventInvites(req, res, decodeURIComponent(eventInviteMatch[1]), eventInviteMatch[2] || ''); return;
    }
    const eventMatch = url.pathname.match(/^\/api\/platform\/events\/([^/]+)$/);
    if (eventMatch && req.method === 'GET') {
      await handleGetEvent(req, res, decodeURIComponent(eventMatch[1])); return;
    }
    if (eventMatch && req.method === 'PUT') {
      const payload = await readJson(req);
      payload.id = decodeURIComponent(eventMatch[1]);
      await requireAdminAuth(req);
      const data = buildEventData(payload);
      const saved = await prisma.event.upsert({
        where: { id: payload.id },
        update: data,
        create: { id: payload.id, ...data }
      });
      sendJson(res, 200, { ok: true, id: saved.id, event: normalizeEventRecord(saved) });
      return;
    }
    if (eventMatch && req.method === 'DELETE') {
      await handleDeleteEvent(req, res, decodeURIComponent(eventMatch[1])); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/resources') {
      await handleListResources(req, res, url); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/resources') {
      await handleSaveResource(req, res); return;
    }
    const resourceMatch = url.pathname.match(/^\/api\/platform\/resources\/([^/]+)$/);
    if (resourceMatch && req.method === 'GET') {
      await handleGetResource(req, res, decodeURIComponent(resourceMatch[1])); return;
    }
    if (resourceMatch && req.method === 'DELETE') {
      await handleDeleteResource(req, res, decodeURIComponent(resourceMatch[1])); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/event-forms') {
      await handleListEventForms(req, res, url); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/event-forms') {
      await handleSaveEventForm(req, res); return;
    }
    const formMatch = url.pathname.match(/^\/api\/platform\/event-forms\/([^/]+)$/);
    if (formMatch && req.method === 'GET') {
      await handleGetEventForm(req, res, decodeURIComponent(formMatch[1])); return;
    }
    const settingMatch = url.pathname.match(/^\/api\/platform\/site-settings\/([^/]+)$/);
    if (settingMatch && (req.method === 'GET' || req.method === 'PUT')) {
      await handleSiteSettings(req, res, decodeURIComponent(settingMatch[1])); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/event-registrations') {
      await handleListEventRegistrations(req, res, url); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/node-lead-applications') {
      await handleListNodeLeadApplications(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/host-applications') {
      await handleListHostApplications(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/error-logs') {
      await handleListErrorLogs(req, res); return;
    }
    const reviewMatch = url.pathname.match(/^\/api\/platform\/(eventRegistrations|nodeLeadApplications|hostApplications)\/([^/]+)\/review$/);
    if (reviewMatch && req.method === 'PUT') {
      await handleUpdateReviewStatus(req, res, reviewMatch[1], decodeURIComponent(reviewMatch[2])); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/subscribers') {
      await handleListSubscribers(req, res); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/skills') {
      await handleCreateSkill(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/platform/skills') {
      await handleListSkills(req, res, url); return;
    }
    const skillRouteMatch = url.pathname.match(/^\/api\/platform\/skills\/([^/]+)$/);
    if (skillRouteMatch && req.method === 'GET') {
      await handleGetSkill(req, res, decodeURIComponent(skillRouteMatch[1])); return;
    }
    if (skillRouteMatch && req.method === 'PUT') {
      await handleUpdateSkill(req, res, decodeURIComponent(skillRouteMatch[1])); return;
    }
    if (skillRouteMatch && req.method === 'DELETE') {
      await handleDeleteSkill(req, res, decodeURIComponent(skillRouteMatch[1])); return;
    }
    const skillReviewMatch = url.pathname.match(/^\/api\/platform\/skills\/([^/]+)\/review$/);
    if (skillReviewMatch && req.method === 'PUT') {
      await handleReviewSkill(req, res, decodeURIComponent(skillReviewMatch[1])); return;
    }
    const skillDownloadMatch = url.pathname.match(/^\/api\/platform\/skills\/([^/]+)\/downloads$/);
    if (skillDownloadMatch && req.method === 'POST') {
      await handleIncrementSkillDownloads(req, res, decodeURIComponent(skillDownloadMatch[1])); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/uploads/update-attachment') {
      await handleUploadFile(req, res, 'update-attachment'); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/platform/uploads/resource-image') {
      await handleUploadFile(req, res, 'resource-image'); return;
    }
  } catch (error) {
    await sendError(req, res, error);
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
      sendFile(res, filePath, getStaticCacheHeaders(filePath, url.pathname));
      return;
    }

    const fallback = path.join(STATIC_ROOT, 'index.html');
    if (HAS_DIST && (url.pathname === '/' || path.extname(url.pathname) === '')) {
      sendFile(res, fallback, getStaticCacheHeaders(fallback, '/index.html'));
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
  console.log(`Storage driver: ${STORAGE_DRIVER}`);
  if (STORAGE_DRIVER === 'local') console.log(`Uploads directory: ${UPLOAD_DIR}`);
  console.log(`Activity log: ${ACTIVITY_LOG_PATH}`);
  console.log(`Error log: ${ERROR_LOG_PATH}`);
  console.log(`Firebase Admin status: ${firebaseInitState.status}`);
  console.log(`Firebase Admin detail: ${firebaseInitState.message}`);
});

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  try { await prisma.$disconnect(); } catch (error) { /* ignore */ }
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
