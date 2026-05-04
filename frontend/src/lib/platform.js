import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, isFirebaseConfigured } from './firebase';
import {
  COMMENT_MODES,
  defaultEventFormSchema,
  defaultNodeLeadFormSchema,
  fallbackEvents,
  fallbackUpdates
} from './defaultContent';

function sortByDateDesc(items, key = 'publishedAt') {
  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === 'string') return new Date(value).getTime();
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return 0;
  }

  return [...items].sort((a, b) => toMillis(b[key]) - toMillis(a[key]));
}

function mapDoc(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

async function apiRequest(path, { method = 'GET', body, requireAuth = false } = {}) {
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth?.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  } else if (requireAuth) {
    throw new Error('You must be logged in.');
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw new Error('The local backend is unavailable. Start or restart the backend server on port 8000, then refresh the frontend.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = payload.error || 'Request failed.';
    if (response.status === 404 && path.startsWith('/api/platform/')) {
      message = 'The running backend is outdated or missing this route. Restart the backend and refresh the frontend.';
    }
    if (response.status === 503 && String(message).includes('FIREBASE_SERVICE_ACCOUNT_PATH')) {
      message = 'Local backend setup is incomplete. Add backend/serviceAccount.json and set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env, then restart the backend.';
    }
    const error = new Error(message);
    error.details = payload.details || null;
    throw error;
  }

  return payload;
}

export async function getPublishedEvents() {
  if (!db) return fallbackEvents;
  const q = query(collection(db, 'events'), where('publishState', '==', 'published'));
  const snap = await getDocs(q);
  if (snap.empty) return fallbackEvents;
  return snap.docs.map(mapDoc).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function getAdminEvents() {
  if (!db) return fallbackEvents;
  const snap = await getDocs(collection(db, 'events'));
  return snap.docs.map(mapDoc).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

export async function getHomeSpotlightSettings() {
  if (!db) return { featuredHomeEventIds: [] };
  const snap = await getDoc(doc(db, 'siteSettings', 'home'));
  if (!snap.exists()) return { featuredHomeEventIds: [] };
  const data = snap.data() || {};
  return {
    featuredHomeEventIds: Array.isArray(data.featuredHomeEventIds) ? data.featuredHomeEventIds.slice(0, 2) : []
  };
}

export async function saveHomeSpotlightSettings(featuredHomeEventIds) {
  if (!db) throw new Error('Firebase is not configured.');
  if (Array.isArray(featuredHomeEventIds) && featuredHomeEventIds.length > 2) {
    throw new Error('Choose up to two events for the home spotlight.');
  }
  const selected = Array.isArray(featuredHomeEventIds) ? featuredHomeEventIds.slice(0, 2) : [];
  await setDoc(doc(db, 'siteSettings', 'home'), {
    featuredHomeEventIds: selected,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { featuredHomeEventIds: selected };
}

export async function getEventById(id) {
  const events = await getPublishedEvents();
  return events.find((event) => event.id === id) || null;
}

export async function saveEvent(event) {
  if (!db) throw new Error('Firebase is not configured.');
  const payload = {
    ...event,
    updatedAt: serverTimestamp()
  };

  if (event.id) {
    await setDoc(doc(db, 'events', event.id), payload, { merge: true });
    return event.id;
  }

  const ref = await addDoc(collection(db, 'events'), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function getFormSchemas(kind = null) {
  if (!db) {
    return kind === 'nodeLead'
      ? [defaultNodeLeadFormSchema]
      : kind === 'event'
        ? [defaultEventFormSchema]
        : [defaultEventFormSchema, defaultNodeLeadFormSchema];
  }

  const base = collection(db, 'eventForms');
  const q = kind ? query(base, where('kind', '==', kind)) : base;
  const snap = await getDocs(q);
  const forms = snap.docs.map(mapDoc);
  if (!forms.length) {
    return kind === 'nodeLead'
      ? [defaultNodeLeadFormSchema]
      : kind === 'event'
        ? [defaultEventFormSchema]
        : [defaultEventFormSchema, defaultNodeLeadFormSchema];
  }
  return forms;
}

export async function getDefaultSchema(kind) {
  const schemas = await getFormSchemas(kind);
  return schemas.find((schema) => schema.isDefault) || schemas[0] || (kind === 'nodeLead' ? defaultNodeLeadFormSchema : defaultEventFormSchema);
}

export async function getSchemaById(id, kind = null) {
  if (!id) return getDefaultSchema(kind || 'event');
  if (!db) {
    const all = await getFormSchemas(kind);
    return all.find((schema) => schema.id === id) || null;
  }

  const snap = await getDoc(doc(db, 'eventForms', id));
  return snap.exists() ? mapDoc(snap) : null;
}

export async function saveFormSchema(schema) {
  if (!db) throw new Error('Firebase is not configured.');
  const payload = {
    ...schema,
    updatedAt: serverTimestamp()
  };

  if (schema.id) {
    await setDoc(doc(db, 'eventForms', schema.id), payload, { merge: true });
    return schema.id;
  }

  const ref = await addDoc(collection(db, 'eventForms'), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function getUpdates() {
  if (!db) return sortByDateDesc(fallbackUpdates);
  const q = query(collection(db, 'updates'), where('publishState', '==', 'published'));
  const snap = await getDocs(q);
  if (snap.empty) return sortByDateDesc(fallbackUpdates);
  return sortByDateDesc(snap.docs.map(mapDoc));
}

export async function getAdminUpdates() {
  if (!db) return sortByDateDesc(fallbackUpdates);
  const snap = await getDocs(collection(db, 'updates'));
  return sortByDateDesc(snap.docs.map(mapDoc));
}

export async function getUpdateBySlug(slug) {
  if (!db) return fallbackUpdates.find((item) => item.slug === slug) || null;
  const q = query(collection(db, 'updates'), where('slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return fallbackUpdates.find((item) => item.slug === slug) || null;
  return mapDoc(snap.docs[0]);
}

export async function saveUpdatePost(update) {
  const payload = {
    ...update,
    commentMode: COMMENT_MODES.includes(update.commentMode) ? update.commentMode : 'moderated'
  };
  const result = await apiRequest('/api/platform/updates', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
  return result.id;
}

export async function getCommentsForUpdate(updateId, includePending = false) {
  if (!db) return [];
  const base = collection(db, 'comments');
  const q = includePending
    ? query(base, where('updateId', '==', updateId), orderBy('createdAt', 'desc'))
    : query(base, where('updateId', '==', updateId), where('status', '==', 'approved'));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

export async function submitUpdateComment(payload) {
  return apiRequest('/api/platform/comments', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
}

export async function submitEventRegistration(payload) {
  return apiRequest('/api/platform/registrations/event', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
}

export async function submitNodeLeadApplication(payload) {
  return apiRequest('/api/platform/node-leads', {
    method: 'POST',
    body: payload
  });
}

export async function submitHostApplication(payload) {
  return apiRequest('/api/platform/hosts', {
    method: 'POST',
    body: payload
  });
}

export async function getEventRegistrations() {
  if (!db) return [];
  const q = query(collection(db, 'eventRegistrations'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

export async function getNodeLeadApplications() {
  if (!db) return [];
  const q = query(collection(db, 'nodeLeadApplications'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

export async function updateReviewStatus(collectionName, id, reviewStatus) {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, collectionName, id), {
    reviewStatus,
    updatedAt: serverTimestamp()
  });
}

export async function getSubscribers() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'newsletterSubscribers'));
  return snap.docs.map(mapDoc);
}

export async function getCommentsForAdmin() {
  if (!db) return [];
  const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

export async function updateCommentStatus(id, status) {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'comments', id), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function deleteDocument(collectionName, id) {
  if (!db) throw new Error('Firebase is not configured.');
  await deleteDoc(doc(db, collectionName, id));
}

export async function exportDataset(dataset, format = 'csv') {
  return apiRequest('/api/platform/exports', {
    method: 'POST',
    body: { dataset, format },
    requireAuth: true
  });
}

export async function exportDatasetForEvent(dataset, format = 'csv', eventId = '') {
  return apiRequest('/api/platform/exports', {
    method: 'POST',
    body: { dataset, format, eventId: eventId || undefined },
    requireAuth: true
  });
}

export async function sendNewsletterCampaign(payload) {
  return apiRequest('/api/platform/newsletter', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
}

export async function saveSubscriber(email, payload = {}) {
  if (!db || !email) return;
  await setDoc(doc(db, 'newsletterSubscribers', email.toLowerCase().replace(/[^a-z0-9]+/g, '-')), {
    email,
    status: 'subscribed',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    ...payload
  }, { merge: true });
}

export async function syncCurrentUser() {
  return apiRequest('/api/platform/auth/sync', {
    method: 'POST',
    body: {},
    requireAuth: true
  });
}

export async function listAdmins() {
  const result = await apiRequest('/api/platform/admins', {
    method: 'GET',
    requireAuth: true
  });
  return result.admins || [];
}

export async function grantAdminRole(payload) {
  return apiRequest('/api/platform/admins/grant', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
}

export async function revokeAdminRole(payload) {
  return apiRequest('/api/platform/admins/revoke', {
    method: 'POST',
    body: payload,
    requireAuth: true
  });
}

export async function leaveAdminRole() {
  return apiRequest('/api/platform/admins/leave', {
    method: 'POST',
    body: {},
    requireAuth: true
  });
}

export async function getSetupStatus() {
  return apiRequest('/api/platform/setup-status', {
    method: 'GET',
    requireAuth: false
  });
}

export async function getBackendHealth() {
  return apiRequest('/api/platform/health', {
    method: 'GET',
    requireAuth: false
  });
}

export async function importContentFile(upload) {
  return apiRequest('/api/platform/import-content', {
    method: 'POST',
    body: { upload },
    requireAuth: true
  });
}

export async function getMemberDashboard() {
  return apiRequest('/api/platform/dashboard', {
    method: 'GET',
    requireAuth: true
  });
}

export async function updateNewsletterPreference(subscribed) {
  return apiRequest('/api/platform/profile/newsletter', {
    method: 'POST',
    body: { subscribed },
    requireAuth: true
  });
}

export async function geocodeAddress(address) {
  return apiRequest('/api/platform/geocode', {
    method: 'POST',
    body: { address },
    requireAuth: true
  });
}

export async function uploadAttachment(file, draftId, onProgress) {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  const safeName = `${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
  const storageRef = ref(storage, `updates/${draftId || 'draft'}/attachments/${safeName}`);
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      resolve
    );
  });
  const url = await getDownloadURL(storageRef);
  return {
    id: safeName,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url,
    downloadable: true
  };
}

export { isFirebaseConfigured };
