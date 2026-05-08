import { auth } from './firebase';
import { apiRequest } from './platform';

export const SKILLDB_CATEGORIES = [
  'AI & Machine Learning',
  'Blockchain',
  'Cybersecurity',
  'Data Engineering',
  'DevOps & Cloud',
  'Embedded Systems & IoT',
  'Mobile Development',
  'Product Management',
  'Student',
  'UI/UX Design',
  'Web Development'
];

export const SKILLDB_MAX_FILE_SIZE = 2 * 1024 * 1024;

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime() || 0;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function safeFileName(name) {
  return String(name || 'skill.md').replace(/[^a-z0-9._-]/gi, '_');
}

function normalizeSkillRecord(skill) {
  if (!skill) return null;
  return {
    ...skill,
    name: String(skill.name || '').trim(),
    phone: String(skill.phone || '').trim(),
    email: String(skill.email || '').trim(),
    category: String(skill.category || '').trim(),
    description: String(skill.description || '').trim(),
    useCase: String(skill.useCase || '').trim(),
    fileName: String(skill.fileName || '').trim(),
    fileSize: Number(skill.fileSize || 0),
    markdownContent: typeof skill.markdownContent === 'string' ? skill.markdownContent : '',
    fileUrl: String(skill.fileUrl || '').trim(),
    filePath: String(skill.filePath || '').trim(),
    downloads: Number(skill.downloads || 0),
    publishState: String(skill.publishState || 'pending').trim(),
    userId: String(skill.userId || '').trim()
  };
}

function computeStats(skills) {
  const contributorSet = new Set();
  const categorySet = new Set();
  for (const skill of skills) {
    if (skill.email) contributorSet.add(skill.email.toLowerCase());
    if (skill.category) categorySet.add(skill.category);
  }
  return {
    totalSkills: skills.length,
    categories: categorySet.size,
    contributors: contributorSet.size
  };
}

export function validateSkillUploadFile(file) {
  if (!file) throw new Error('Upload a Markdown file.');
  if (!String(file.name || '').toLowerCase().endsWith('.md')) {
    throw new Error('Only .md Markdown files are allowed.');
  }
  if (!file.size) throw new Error('The uploaded Markdown file is empty.');
  if (file.size > SKILLDB_MAX_FILE_SIZE) {
    throw new Error('The Markdown file must be 2 MB or smaller.');
  }
}

export function formatSkillFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

export async function getPublishedSkills() {
  const result = await apiRequest('/api/platform/skills').catch(() => ({ skills: [] }));
  return sortByCreatedAtDesc((result.skills || []).map(normalizeSkillRecord).filter(Boolean));
}

export async function getSkillDBStats() {
  const skills = await getPublishedSkills();
  return computeStats(skills);
}

export async function getAdminSkills() {
  const result = await apiRequest('/api/platform/skills?admin=1', { requireAuth: true });
  return sortByCreatedAtDesc((result.skills || []).map(normalizeSkillRecord).filter(Boolean));
}

export async function getUserSkills(userId) {
  if (!userId) return [];
  const result = await apiRequest(`/api/platform/skills?userId=${encodeURIComponent(userId)}`, { requireAuth: true });
  return sortByCreatedAtDesc((result.skills || []).map(normalizeSkillRecord).filter(Boolean));
}

async function uploadSkillMultipart({ method, path, fields, file, onProgress }) {
  if (!auth?.currentUser) throw new Error('You must be logged in.');
  const token = await auth.currentUser.getIdToken();
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields || {})) {
    formData.append(key, value ?? '');
  }
  if (file) formData.append('file', file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, path);
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

export async function createSkillSubmission(payload, file, user, onProgress) {
  if (!user?.uid) throw new Error('You must be logged in to upload a skill.');
  validateSkillUploadFile(file);
  const fields = {
    name: String(payload?.name || '').trim(),
    phone: String(payload?.phone || '').trim(),
    email: String(payload?.email || '').trim(),
    category: String(payload?.category || '').trim(),
    description: String(payload?.description || '').trim(),
    useCase: String(payload?.useCase || '').trim()
  };
  if (!fields.name || !fields.email || !fields.category || !fields.description || !fields.useCase) {
    throw new Error('Fill every required field before uploading.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new Error('Please enter a valid email address.');
  }

  return uploadSkillMultipart({
    method: 'POST',
    path: '/api/platform/skills',
    fields,
    file,
    onProgress
  });
}

export async function updateSkillSubmission(skillId, existingSkill, payload, file, user, onProgress) {
  if (!user?.uid || user.uid !== existingSkill?.userId) {
    throw new Error('You can only edit your own submissions.');
  }
  if (file) validateSkillUploadFile(file);
  const fields = {
    name: String(payload?.name || '').trim(),
    phone: String(payload?.phone || '').trim(),
    email: String(payload?.email || '').trim(),
    category: String(payload?.category || '').trim(),
    description: String(payload?.description || '').trim(),
    useCase: String(payload?.useCase || '').trim()
  };
  if (!fields.name || !fields.email || !fields.category || !fields.description || !fields.useCase) {
    throw new Error('Fill every required field before saving.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new Error('Please enter a valid email address.');
  }
  return uploadSkillMultipart({
    method: 'PUT',
    path: `/api/platform/skills/${encodeURIComponent(skillId)}`,
    fields,
    file: file || null,
    onProgress
  });
}

export async function deleteSkillSubmission(skill, user, isAdmin = false) {
  if (!skill?.id) throw new Error('Missing skill id.');
  if (!isAdmin && user?.uid !== skill.userId) {
    throw new Error('You can only delete your own submissions.');
  }
  return apiRequest(`/api/platform/skills/${encodeURIComponent(skill.id)}`, {
    method: 'DELETE',
    requireAuth: true
  });
}

export async function reviewSkillSubmission(skillId, publishState) {
  return apiRequest(`/api/platform/skills/${encodeURIComponent(skillId)}/review`, {
    method: 'PUT',
    body: { publishState },
    requireAuth: true
  });
}

export async function incrementSkillDownloads(skillId) {
  if (!skillId) return null;
  return apiRequest(`/api/platform/skills/${encodeURIComponent(skillId)}/downloads`, {
    method: 'POST'
  }).catch(() => null);
}

export function downloadSkillMarkdown(skill) {
  if (!skill) throw new Error('Skill not found.');
  const content = String(skill.markdownContent || '').trim();
  if (!content) {
    if (skill.fileUrl) {
      window.open(skill.fileUrl, '_blank', 'noopener');
      return;
    }
    throw new Error('This skill does not have a downloadable markdown file yet.');
  }
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(skill.fileName || `${safeFileName(skill.name || 'skill')}.md`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
