import { auth, isFirebaseConfigured } from './firebase';
import {
  COMMENT_MODES,
  defaultEventFormSchema,
  defaultNodeLeadFormSchema,
  fallbackEvents,
  fallbackResources,
  fallbackUpdates
} from './defaultContent';
import { normalizeEventRecord } from './events';

function sortByDateDesc(items, key = 'publishedAt') {
  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === 'string') return new Date(value).getTime();
    if (value instanceof Date) return value.getTime();
    return 0;
  }
  return [...items].sort((a, b) => toMillis(b[key]) - toMillis(a[key]));
}

function normalizeEventDocuments(items) {
  return items.map((item) => normalizeEventRecord(item)).filter(Boolean);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeResourceRecord(resource) {
  if (!resource) return null;

  const body = Array.isArray(resource.body)
    ? resource.body.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const image = resource.image && typeof resource.image === 'object'
    ? {
      url: typeof resource.image.url === 'string' ? resource.image.url : '',
      name: typeof resource.image.name === 'string' ? resource.image.name : '',
      mimeType: typeof resource.image.mimeType === 'string' ? resource.image.mimeType : ''
    }
    : null;

  return {
    ...resource,
    title: typeof resource.title === 'string' ? resource.title : 'Untitled Resource',
    slug: slugify(resource.slug || resource.title || resource.id || 'resource'),
    sourceLabel: typeof resource.sourceLabel === 'string' ? resource.sourceLabel : '',
    excerpt: typeof resource.excerpt === 'string' ? resource.excerpt : '',
    body,
    bodyHtml: typeof resource.bodyHtml === 'string' ? resource.bodyHtml : body.map((paragraph) => `<p>${paragraph}</p>`).join(''),
    ctaLabel: typeof resource.ctaLabel === 'string' ? resource.ctaLabel : 'Open resource',
    ctaUrl: typeof resource.ctaUrl === 'string' ? resource.ctaUrl : '',
    image,
    publishState: typeof resource.publishState === 'string' ? resource.publishState : 'draft'
  };
}

function sortByUpdatedAtDesc(items) {
  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === 'string') return new Date(value).getTime();
    if (value instanceof Date) return value.getTime();
    return 0;
  }
  return [...items].sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
}

async function apiRequest(path, { method = 'GET', body, requireAuth = false, formData } = {}) {
  const headers = {};

  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';
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
      body: formData ? formData : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  } catch (error) {
    throw new Error('The backend is unavailable. Start or restart the backend server, then refresh the frontend.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = payload.error || 'Request failed.';
    if (response.status === 404 && path.startsWith('/api/platform/') && !payload.error) {
      message = 'The running backend is outdated or missing this route. Restart the backend and refresh the frontend.';
    }
    if (response.status === 503 && String(message).includes('FIREBASE_SERVICE_ACCOUNT_PATH')) {
      message = 'Backend setup is incomplete. Add backend/serviceAccount.json and set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env, then restart the backend.';
    }
    const error = new Error(message);
    error.details = payload.details || null;
    throw error;
  }

  return payload;
}

// Re-export so other modules can keep using the helper if needed
export { apiRequest };

export async function getPublishedEvents() {
  if (!isFirebaseConfigured) return normalizeEventDocuments(fallbackEvents);
  const result = await apiRequest('/api/platform/events').catch(() => ({ events: [] }));
  const events = normalizeEventDocuments(result.events || []);
  return events.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

export async function getAdminEvents() {
  const result = await apiRequest('/api/platform/events?admin=1', { requireAuth: true });
  const events = normalizeEventDocuments(result.events || []);
  return events.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

export async function getHomeSpotlightSettings() {
  const result = await apiRequest('/api/platform/site-settings/home').catch(() => ({ value: null }));
  const value = result?.value || {};
  return {
    featuredHomeEventIds: Array.isArray(value.featuredHomeEventIds) ? value.featuredHomeEventIds.slice(0, 2) : []
  };
}

export async function saveHomeSpotlightSettings(featuredHomeEventIds) {
  if (Array.isArray(featuredHomeEventIds) && featuredHomeEventIds.length > 2) {
    throw new Error('Choose up to two events for the home spotlight.');
  }
  const selected = Array.isArray(featuredHomeEventIds) ? featuredHomeEventIds.slice(0, 2) : [];
  await apiRequest('/api/platform/site-settings/home', {
    method: 'PUT',
    body: { value: { featuredHomeEventIds: selected } },
    requireAuth: true
  });
  return { featuredHomeEventIds: selected };
}

export async function getEventById(id) {
  if (!id) return null;
  try {
    const result = await apiRequest(`/api/platform/events/${encodeURIComponent(id)}`);
    return normalizeEventRecord(result.event) || null;
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('not found')) return null;
    throw error;
  }
}

export async function saveEvent(event) {
  const payload = { ...normalizeEventRecord(event), id: event.id };
  const method = event.id ? 'PUT' : 'POST';
  const path = event.id ? `/api/platform/events/${encodeURIComponent(event.id)}` : '/api/platform/events';
  const result = await apiRequest(path, { method, body: payload, requireAuth: true });
  return result.id;
}

export async function getFormSchemas(kind = null) {
  const path = kind ? `/api/platform/event-forms?kind=${encodeURIComponent(kind)}` : '/api/platform/event-forms';
  const result = await apiRequest(path).catch(() => ({ forms: [] }));
  const forms = result.forms || [];
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
  try {
    const result = await apiRequest(`/api/platform/event-forms/${encodeURIComponent(id)}`);
    return result.form || null;
  } catch (error) {
    return null;
  }
}

export async function saveFormSchema(schema) {
  const result = await apiRequest('/api/platform/event-forms', {
    method: 'POST',
    body: schema,
    requireAuth: true
  });
  return result.id;
}

export async function getUpdates() {
  const result = await apiRequest('/api/platform/updates').catch(() => ({ updates: [] }));
  if (!result.updates?.length) return sortByDateDesc(fallbackUpdates);
  return sortByDateDesc(result.updates);
}

export async function getAdminUpdates() {
  const result = await apiRequest('/api/platform/updates?admin=1', { requireAuth: true });
  return sortByDateDesc(result.updates || []);
}

export async function getUpdateBySlug(slug) {
  if (!slug) return null;
  try {
    const result = await apiRequest(`/api/platform/updates/${encodeURIComponent(slug)}`);
    return result.update || null;
  } catch (error) {
    return fallbackUpdates.find((item) => item.slug === slug) || null;
  }
}

export async function getPublishedResources() {
  const result = await apiRequest('/api/platform/resources').catch(() => ({ resources: [] }));
  const resources = (result.resources || []).map(normalizeResourceRecord).filter(Boolean);
  if (!resources.length) {
    return sortByUpdatedAtDesc(fallbackResources.map(normalizeResourceRecord).filter(Boolean));
  }
  return sortByUpdatedAtDesc(resources);
}

export async function getAdminResources() {
  const result = await apiRequest('/api/platform/resources?admin=1', { requireAuth: true });
  const resources = (result.resources || []).map(normalizeResourceRecord).filter(Boolean);
  return sortByUpdatedAtDesc(resources);
}

export async function getResourceBySlug(slug) {
  if (!slug) return null;
  try {
    const result = await apiRequest(`/api/platform/resources/${encodeURIComponent(slug)}`);
    return normalizeResourceRecord(result.resource);
  } catch (error) {
    return fallbackResources.map(normalizeResourceRecord).find((item) => item?.slug === slug) || null;
  }
}

export async function saveResource(resource) {
  const normalized = normalizeResourceRecord(resource);
  const result = await apiRequest('/api/platform/resources', {
    method: 'POST',
    body: { ...normalized, id: resource.id },
    requireAuth: true
  });
  return result.id;
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
  const path = `/api/platform/comments?updateId=${encodeURIComponent(updateId)}${includePending ? '&all=1' : ''}`;
  const result = await apiRequest(path, { requireAuth: includePending }).catch(() => ({ comments: [] }));
  return result.comments || [];
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

export async function getEventRegistrations(eventId = '') {
  const path = eventId
    ? `/api/platform/event-registrations?eventId=${encodeURIComponent(eventId)}`
    : '/api/platform/event-registrations';
  const result = await apiRequest(path, { requireAuth: true });
  return result.registrations || [];
}

export async function getNodeLeadApplications() {
  const result = await apiRequest('/api/platform/node-lead-applications', { requireAuth: true });
  return result.applications || [];
}

export async function updateReviewStatus(collectionName, id, reviewStatus) {
  return apiRequest(`/api/platform/${collectionName}/${encodeURIComponent(id)}/review`, {
    method: 'PUT',
    body: { reviewStatus },
    requireAuth: true
  });
}

export async function getSubscribers() {
  const result = await apiRequest('/api/platform/subscribers', { requireAuth: true });
  return result.subscribers || [];
}

export async function getCommentsForAdmin() {
  const result = await apiRequest('/api/platform/admin/comments', { requireAuth: true });
  return result.comments || [];
}

export async function updateCommentStatus(id, status) {
  return apiRequest(`/api/platform/comments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { status },
    requireAuth: true
  });
}

export async function deleteDocument(collectionName, id) {
  const map = {
    events: 'events',
    updates: 'updates/id',
    resources: 'resources',
    comments: 'comments',
    skills: 'skills'
  };
  const segment = map[collectionName];
  if (!segment) throw new Error(`Cannot delete from ${collectionName}.`);
  return apiRequest(`/api/platform/${segment}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    requireAuth: true
  });
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

export async function saveSubscriber() {
  // Subscribers are managed server-side via newsletter sync. Kept for API compatibility.
  return null;
}

export async function syncCurrentUser() {
  return apiRequest('/api/platform/auth/sync', {
    method: 'POST',
    body: {},
    requireAuth: true
  });
}

export async function listAdmins() {
  const result = await apiRequest('/api/platform/admins', { method: 'GET', requireAuth: true });
  return result.admins || [];
}

export async function grantAdminRole(payload) {
  return apiRequest('/api/platform/admins/grant', { method: 'POST', body: payload, requireAuth: true });
}

export async function revokeAdminRole(payload) {
  return apiRequest('/api/platform/admins/revoke', { method: 'POST', body: payload, requireAuth: true });
}

export async function leaveAdminRole() {
  return apiRequest('/api/platform/admins/leave', { method: 'POST', body: {}, requireAuth: true });
}

export async function getSetupStatus() {
  return apiRequest('/api/platform/setup-status', { method: 'GET', requireAuth: false });
}

export async function getBackendHealth() {
  return apiRequest('/api/platform/health', { method: 'GET', requireAuth: false });
}

export async function importContentFile(upload) {
  return apiRequest('/api/platform/import-content', {
    method: 'POST',
    body: { upload },
    requireAuth: true
  });
}

export async function getMemberDashboard() {
  return apiRequest('/api/platform/dashboard', { method: 'GET', requireAuth: true });
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

async function uploadViaBackend(kind, file, draftId, onProgress) {
  if (!auth?.currentUser) throw new Error('You must be logged in.');
  const token = await auth.currentUser.getIdToken();
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('draftId', draftId || 'draft');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/platform/uploads/${kind}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed because the backend is unavailable.'));
    xhr.onload = () => {
      let payload = {};
      try { payload = JSON.parse(xhr.responseText || '{}'); } catch (error) { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        reject(new Error(payload?.error || `Upload failed with status ${xhr.status}.`));
      }
    };
    xhr.send(formData);
  });
}

export async function uploadAttachment(file, draftId, onProgress) {
  const result = await uploadViaBackend('update-attachment', file, draftId, onProgress);
  return {
    id: result.id,
    name: result.name || file.name,
    mimeType: result.mimeType || file.type || 'application/octet-stream',
    size: result.size || file.size,
    url: result.url,
    downloadable: true
  };
}

export async function uploadResourceImage(file, draftId, onProgress) {
  const result = await uploadViaBackend('resource-image', file, draftId, onProgress);
  return {
    url: result.url,
    name: result.name || file.name,
    mimeType: result.mimeType || file.type || 'application/octet-stream',
    size: result.size || file.size
  };
}

export { isFirebaseConfigured };
