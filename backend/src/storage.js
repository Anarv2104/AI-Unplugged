const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, 'uploads');

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeRelPath(relPath) {
  const normalized = path.posix.normalize(String(relPath || '').replace(/\\/g, '/'));
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid upload path.');
  }
  return normalized.replace(/^\/+/, '');
}

function absoluteFromRel(relPath) {
  const safe = safeRelPath(relPath);
  return path.join(UPLOAD_DIR, safe);
}

function publicUrlFor(relPath) {
  const safe = safeRelPath(relPath);
  const encoded = safe.split('/').map(encodeURIComponent).join('/');
  return `${PUBLIC_BASE_URL}/uploads/${encoded}`;
}

function saveUpload(buffer, relPath) {
  ensureUploadDir();
  const target = absoluteFromRel(relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return {
    relPath: safeRelPath(relPath),
    absolutePath: target,
    url: publicUrlFor(relPath),
    size: buffer.length
  };
}

function deleteUpload(relPath) {
  if (!relPath) return;
  try {
    const target = absoluteFromRel(relPath);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    // ignore — best effort
  }
}

function resolveServePath(urlPath) {
  const stripped = String(urlPath || '').replace(/^\/uploads\/+/, '');
  if (!stripped) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(stripped);
  } catch (error) {
    return null;
  }
  let target;
  try {
    target = absoluteFromRel(decoded);
  } catch (error) {
    return null;
  }
  if (!target.startsWith(UPLOAD_DIR)) return null;
  return target;
}

module.exports = {
  UPLOAD_DIR,
  ensureUploadDir,
  saveUpload,
  deleteUpload,
  publicUrlFor,
  resolveServePath
};
