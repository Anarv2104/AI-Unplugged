const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const XLSX = require('xlsx');
const { createBrevoProvider, splitEmails } = require('./mailProvider');

admin.initializeApp();

const db = admin.firestore();
const BREVO_API_KEY = defineSecret('BREVO_API_KEY');
const BREVO_SENDER_EMAIL = defineSecret('BREVO_SENDER_EMAIL');
const BREVO_SENDER_NAME = defineSecret('BREVO_SENDER_NAME');
const BOOTSTRAP_ADMIN_EMAILS = defineSecret('BOOTSTRAP_ADMIN_EMAILS');
const mailProvider = createBrevoProvider({
  apiKeySecret: BREVO_API_KEY,
  senderEmailSecret: BREVO_SENDER_EMAIL,
  senderNameSecret: BREVO_SENDER_NAME
});
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

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }
}

async function requireAdmin(request) {
  requireAuth(request);
  if (request.auth.token.admin === true) return;
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (userDoc.exists && userDoc.data().role === 'admin') return;
  throw new HttpsError('permission-denied', 'Admin access required.');
}

async function countAdmins() {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  return snap.size;
}

async function resolveUid({ uid, email }) {
  if (uid) return uid;
  if (email) {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  }
  throw new HttpsError('invalid-argument', 'A uid or email is required.');
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

async function applyBootstrapAdminIfNeeded(user) {
  if (!user || !user.email) return false;
  const allowlist = splitEmails(BOOTSTRAP_ADMIN_EMAILS.value());
  if (!allowlist.length) return false;
  if (!allowlist.includes(String(user.email).toLowerCase())) return false;

  const record = await admin.auth().getUser(user.uid);
  if (record.customClaims?.admin === true) return true;
  await setAdminState(user.uid, true);
  return true;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeEntryType(entry) {
  const value = String(entry || '').trim().toLowerCase();
  if (value === 'open') return 'open';
  if (value === 'invite only') return 'invite-only';
  if (value === 'curated') return 'curated';
  return 'application';
}

function makeRegistrationId() {
  return `AIU-${new Date().getFullYear()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
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
        type: FORM_FIELD_TYPES.has(field?.type) ? field.type : 'text',
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

function flattenExportRow(row, { includeFormSchema = true } = {}) {
  const answers = row.answers || {};
  const clean = { ...row };
  delete clean.answers;
  if (!includeFormSchema) delete clean.formSchema;
  return { ...clean, ...answers };
}

async function getSchemaForKind({ kind, schemaId }) {
  if (schemaId) {
    const doc = await db.collection('eventForms').doc(schemaId).get();
    if (!doc.exists && kind === 'event' && schemaId === BUILT_IN_DEFAULT_EVENT_SCHEMA.id) return BUILT_IN_DEFAULT_EVENT_SCHEMA;
    if (!doc.exists && kind === 'nodeLead' && schemaId === BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA.id) return BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA;
    if (!doc.exists) throw new HttpsError('not-found', 'Form schema not found.');
    return { id: doc.id, ...doc.data() };
  }

  const snap = await db.collection('eventForms')
    .where('kind', '==', kind)
    .where('isDefault', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    if (kind === 'event') return BUILT_IN_DEFAULT_EVENT_SCHEMA;
    if (kind === 'nodeLead') return BUILT_IN_DEFAULT_NODE_LEAD_SCHEMA;
    throw new HttpsError('failed-precondition', `Default ${kind} schema is missing.`);
  }
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

exports.submitEventRegistration = onCall(async (request) => {
  const data = request.data || {};
  const eventId = data.eventId;
  if (!eventId) throw new HttpsError('invalid-argument', 'Event is required.');

  const eventDoc = await db.collection('events').doc(eventId).get();
  if (!eventDoc.exists) throw new HttpsError('not-found', 'Event not found.');
  const event = eventDoc.data();
  if (event.publishState !== 'published') {
    throw new HttpsError('failed-precondition', 'Event is not open for registration.');
  }
  const entryType = normalizeEntryType(event.entry);
  if (entryType === 'invite-only') {
    throw new HttpsError('failed-precondition', 'This event is invite only. Registration is not open through the public attend form.');
  }

  const schema = await getSchemaForKind({
    kind: 'event',
    schemaId: event.formId || null
  });

  const { normalized, errors } = validateAnswers(schema, data.answers || {});
  if (Object.keys(errors).length) {
    throw new HttpsError('invalid-argument', 'Validation failed.', { errors });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const email = normalized.email || data.email || '';
  const userRef = request.auth ? db.collection('users').doc(request.auth.uid) : null;
  const registrationId = makeRegistrationId();

  const registration = {
    registrationId,
    eventId,
    eventTitle: event.title,
    entryType,
    formId: schema.id,
    formTitle: schema.title,
    formSchema: buildFormSchemaSnapshot(schema),
    answers: normalized,
    reviewStatus: entryType === 'open' ? 'accepted' : 'pending',
    source: request.auth ? 'member' : 'guest',
    userId: request.auth ? request.auth.uid : null,
    name: normalized.name || data.name || '',
    email,
    organization: normalized.organization || '',
    createdAt: now,
    updatedAt: now,
    subscribedToNewsletter: true
  };

  const docRef = await db.collection('eventRegistrations').add(registration);

  if (request.auth) {
    await userRef.set({
      email: request.auth.token.email || email || null,
      displayName: request.auth.token.name || normalized.name || null,
      newsletterSubscribed: true,
      updatedAt: now
    }, { merge: true });
  }

  if (email) {
    await db.collection('newsletterSubscribers').doc(slugify(email)).set({
      email,
      status: 'subscribed',
      source: request.auth ? 'registration-member' : 'registration-guest',
      userId: request.auth ? request.auth.uid : null,
      updatedAt: now,
      createdAt: now
    }, { merge: true });
  }

  return { ok: true, id: docRef.id, registrationId, entryType, reviewStatus: registration.reviewStatus };
});

exports.submitNodeLeadApplication = onCall(async (request) => {
  const data = request.data || {};
  const schema = await getSchemaForKind({ kind: 'nodeLead', schemaId: data.schemaId || null });
  const { normalized, errors } = validateAnswers(schema, data.answers || {});

  if (Object.keys(errors).length) {
    throw new HttpsError('invalid-argument', 'Validation failed.', { errors });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('nodeLeadApplications').add({
    formId: schema.id,
    formTitle: schema.title,
    formSchema: buildFormSchemaSnapshot(schema),
    answers: normalized,
    email: normalized.email || '',
    name: normalized.name || '',
    reviewStatus: 'pending',
    userId: request.auth ? request.auth.uid : null,
    createdAt: now,
    updatedAt: now
  });

  return { ok: true, id: docRef.id };
});

exports.submitUpdateComment = onCall(async (request) => {
  requireAuth(request);
  const { updateId, body } = request.data || {};
  if (!updateId || !String(body || '').trim()) {
    throw new HttpsError('invalid-argument', 'Update and comment body are required.');
  }

  const updateDoc = await db.collection('updates').doc(updateId).get();
  if (!updateDoc.exists) throw new HttpsError('not-found', 'Update not found.');
  const update = updateDoc.data();
  if (update.publishState !== 'published') {
    throw new HttpsError('failed-precondition', 'Update is not available.');
  }
  if (update.commentMode === 'disabled') {
    throw new HttpsError('failed-precondition', 'Comments are disabled for this post.');
  }

  const status = update.commentMode === 'moderated' ? 'pending' : 'approved';
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = await db.collection('comments').add({
    updateId,
    updateSlug: update.slug,
    body: String(body).trim(),
    status,
    userId: request.auth.uid,
    authorName: request.auth.token.name || request.auth.token.email || 'Member',
    authorEmail: request.auth.token.email || null,
    createdAt: now,
    updatedAt: now
  });

  return { ok: true, id: docRef.id, status };
});

exports.exportDataset = onCall(async (request) => {
  await requireAdmin(request);
  const { dataset, format = 'csv' } = request.data || {};
  const collectionName =
    dataset === 'nodeLeadApplications' ? 'nodeLeadApplications' : 'eventRegistrations';

  const snap = await db.collection(collectionName).get();
  const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (format === 'json') {
    return {
      ok: true,
      filename: `${collectionName}.json`,
      mimeType: 'application/json',
      base64: Buffer.from(JSON.stringify(rows.map((row) => flattenExportRow(row, { includeFormSchema: true })), null, 2)).toString('base64')
    };
  }

  const flatRows = rows.map((row) => flattenExportRow(row, { includeFormSchema: false }));

  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

  if (format === 'xlsx') {
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      ok: true,
      filename: `${collectionName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(buffer).toString('base64')
    };
  }

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return {
    ok: true,
    filename: `${collectionName}.csv`,
    mimeType: 'text/csv',
    base64: Buffer.from(csv).toString('base64')
  };
});

exports.sendNewsletterCampaign = onCall({ secrets: [BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME] }, async (request) => {
  await requireAdmin(request);
  const { subject, html, text } = request.data || {};
  if (!subject || !html) {
    throw new HttpsError('invalid-argument', 'Subject and HTML content are required.');
  }

  const subscribersSnap = await db.collection('newsletterSubscribers')
    .where('status', '==', 'subscribed')
    .get();

  const recipients = subscribersSnap.docs
    .map((doc) => doc.data().email)
    .filter(Boolean)
    .slice(0, 300);

  if (!recipients.length) {
    return { ok: true, sent: 0 };
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

  return { ok: true, sent: recipients.length };
});

exports.syncCurrentUser = onCall({ secrets: [BOOTSTRAP_ADMIN_EMAILS] }, async (request) => {
  requireAuth(request);
  const userRecord = await admin.auth().getUser(request.auth.uid);
  const bootstrapApplied = await applyBootstrapAdminIfNeeded(userRecord);

  const profileRef = db.collection('users').doc(request.auth.uid);
  await profileRef.set({
    email: userRecord.email || request.auth.token.email || '',
    displayName: userRecord.displayName || request.auth.token.name || '',
    role: bootstrapApplied || request.auth.token.admin === true ? 'admin' : 'user',
    newsletterSubscribed: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const profileSnap = await profileRef.get();
  return {
    ok: true,
    profile: { id: profileSnap.id, ...profileSnap.data() },
    setupWarnings: {
      missingBootstrapAdmins: splitEmails(BOOTSTRAP_ADMIN_EMAILS.value()).length === 0
    }
  };
});

exports.listAdmins = onCall(async (request) => {
  await requireAdmin(request);
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  return {
    ok: true,
    admins: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  };
});

exports.grantAdminRole = onCall(async (request) => {
  await requireAdmin(request);
  const targetUid = await resolveUid(request.data || {});
  await setAdminState(targetUid, true);
  return { ok: true, uid: targetUid };
});

exports.revokeAdminRole = onCall(async (request) => {
  await requireAdmin(request);
  const targetUid = await resolveUid(request.data || {});
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new HttpsError('failed-precondition', 'At least one admin must remain on the platform.');
  }
  await setAdminState(targetUid, false);
  return { ok: true, uid: targetUid };
});

exports.leaveAdminRole = onCall(async (request) => {
  await requireAdmin(request);
  const adminCount = await countAdmins();
  if (adminCount <= 1) {
    throw new HttpsError('failed-precondition', 'You must assign another admin before removing your own admin access.');
  }
  await setAdminState(request.auth.uid, false);
  return { ok: true, uid: request.auth.uid };
});

exports.getSetupStatus = onCall({ secrets: [BREVO_API_KEY, BREVO_SENDER_EMAIL, BOOTSTRAP_ADMIN_EMAILS] }, async (request) => {
  await requireAdmin(request);
  const warnings = [];

  if (!BREVO_API_KEY.value()) warnings.push('BREVO_API_KEY is missing.');
  if (!BREVO_SENDER_EMAIL.value()) warnings.push('BREVO_SENDER_EMAIL is missing.');
  if (splitEmails(BOOTSTRAP_ADMIN_EMAILS.value()).length === 0) warnings.push('BOOTSTRAP_ADMIN_EMAILS is empty.');

  return {
    ok: true,
    mailProvider: mailProvider.providerName,
    warnings
  };
});
