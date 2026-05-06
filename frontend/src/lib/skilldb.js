import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';

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

export const SKILLDB_MAX_FILE_SIZE = 300 * 1024;
export const SKILLDB_META_DOC_ID = '__skilldb_meta__';

function mapDoc(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
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
    userId: String(skill.userId || '').trim(),
    kind: String(skill.kind || 'skill').trim()
  };
}

function isRealSkill(skill) {
  return Boolean(skill) && skill.id !== SKILLDB_META_DOC_ID && skill.kind !== 'meta';
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
  if (!file.size) {
    throw new Error('The uploaded Markdown file is empty.');
  }
  if (file.size > SKILLDB_MAX_FILE_SIZE) {
    throw new Error('The Markdown file must be 300 KB or smaller.');
  }
}

export function formatSkillFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

async function ensureSkillsBootstrap() {
  if (!db || !auth?.currentUser) return;
  const metaRef = doc(db, 'skills', SKILLDB_META_DOC_ID);
  await setDoc(metaRef, {
    kind: 'meta',
    label: 'SkillDB bootstrap',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

async function readMarkdownFile(file, onProgress) {
  validateSkillUploadFile(file);
  onProgress?.(15);
  const text = await file.text();
  if (!text.trim()) {
    throw new Error('The uploaded Markdown file is empty.');
  }
  const encodedSize = new TextEncoder().encode(text).length;
  if (encodedSize > SKILLDB_MAX_FILE_SIZE) {
    throw new Error('The Markdown content is too large for Firestore. Keep it under 300 KB.');
  }
  onProgress?.(45);
  return {
    fileName: safeFileName(file.name || 'skill.md'),
    fileSize: encodedSize,
    markdownContent: text
  };
}

export async function getPublishedSkills() {
  if (!db) return [];
  const q = query(collection(db, 'skills'), where('publishState', '==', 'published'));
  const snap = await getDocs(q);
  return sortByCreatedAtDesc(snap.docs.map(mapDoc).map(normalizeSkillRecord).filter(isRealSkill));
}

export async function getSkillDBStats() {
  await ensureSkillsBootstrap();
  const publishedSkills = await getPublishedSkills();
  return computeStats(publishedSkills);
}

export async function getAdminSkills() {
  if (!db) return [];
  await ensureSkillsBootstrap();
  const snap = await getDocs(collection(db, 'skills'));
  return sortByCreatedAtDesc(snap.docs.map(mapDoc).map(normalizeSkillRecord).filter(isRealSkill));
}

export async function getUserSkills(userId) {
  if (!db || !userId) return [];
  await ensureSkillsBootstrap();
  const q = query(collection(db, 'skills'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return sortByCreatedAtDesc(snap.docs.map(mapDoc).map(normalizeSkillRecord).filter(isRealSkill));
}

export async function createSkillSubmission(payload, file, user, onProgress) {
  if (!db) throw new Error('Firebase is not configured.');
  if (!user?.uid) throw new Error('You must be logged in to upload a skill.');
  await ensureSkillsBootstrap();
  const upload = await readMarkdownFile(file, onProgress);
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
  onProgress?.(70);
  const ref = await addDoc(collection(db, 'skills'), {
    kind: 'skill',
    ...fields,
    ...upload,
    publishState: 'pending',
    downloads: 0,
    userId: user.uid,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  onProgress?.(100);
  return {
    ok: true,
    id: ref.id,
    skillId: ref.id,
    publishState: 'pending',
    message: 'Thank you. Your skill has been submitted for review.',
    subMessage: 'Your markdown file is now in the approval queue. Once an admin publishes it, it will appear on the SkillDB dashboard for everyone to browse and download.'
  };
}

export async function updateSkillSubmission(skillId, existingSkill, payload, file, user, onProgress) {
  if (!db) throw new Error('Firebase is not configured.');
  if (!user?.uid || user.uid !== existingSkill?.userId) {
    throw new Error('You can only edit your own submissions.');
  }
  await ensureSkillsBootstrap();
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
  onProgress?.(20);
  let upload = {};
  if (file) {
    upload = await readMarkdownFile(file, onProgress);
  }
  onProgress?.(75);
  await updateDoc(doc(db, 'skills', skillId), {
    ...fields,
    ...upload,
    publishState: 'pending',
    reviewedAt: null,
    reviewedBy: null,
    updatedAt: serverTimestamp()
  });
  onProgress?.(100);
  return {
    ok: true,
    id: skillId,
    skillId,
    publishState: 'pending',
    message: 'Thank you. Your updated skill has been submitted for review.',
    subMessage: 'The updated version is back in the approval queue and will replace the public version after an admin publishes it.'
  };
}

export async function deleteSkillSubmission(skill, user, isAdmin = false) {
  if (!db) throw new Error('Firebase is not configured.');
  if (!skill?.id) throw new Error('Missing skill id.');
  if (!isAdmin && user?.uid !== skill.userId) {
    throw new Error('You can only delete your own submissions.');
  }
  await deleteDoc(doc(db, 'skills', skill.id));
}

export async function reviewSkillSubmission(skillId, publishState, reviewerId = '') {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'skills', skillId), {
    publishState,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerId || auth?.currentUser?.uid || '',
    updatedAt: serverTimestamp()
  });
}

export async function incrementSkillDownloads(skillId) {
  if (!db || !skillId) return;
  await updateDoc(doc(db, 'skills', skillId), {
    downloads: increment(1),
    updatedAt: serverTimestamp()
  });
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
