const fs = require('fs');
const path = require('path');
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const ROOT = path.resolve(__dirname, '..');
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, 'uploads');

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const STORAGE_DRIVER = String(process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() === 's3' ? 's3' : 'local';
const S3_BUCKET = String(process.env.S3_BUCKET || '').trim();
const S3_REGION = String(process.env.S3_REGION || '').trim();
const S3_PUBLIC_BASE_URL = String(process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');

let s3Client = null;

function ensureUploadDir() {
  if (STORAGE_DRIVER !== 'local') return;
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

function s3ConfigWarnings() {
  if (STORAGE_DRIVER !== 's3') return [];
  const warnings = [];
  if (!S3_BUCKET) warnings.push('S3_BUCKET is required when STORAGE_DRIVER=s3.');
  if (!S3_REGION) warnings.push('S3_REGION is required when STORAGE_DRIVER=s3.');
  if ((process.env.S3_ACCESS_KEY_ID && !process.env.S3_SECRET_ACCESS_KEY) || (!process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)) {
    warnings.push('Both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when using key-based S3 auth.');
  }
  if (!S3_PUBLIC_BASE_URL) warnings.push('S3_PUBLIC_BASE_URL is recommended so uploaded file URLs are stable/CDN-backed.');
  return warnings;
}

function assertS3Ready() {
  const blocking = s3ConfigWarnings().filter((warning) => !warning.startsWith('S3_PUBLIC_BASE_URL'));
  if (blocking.length) throw new Error(blocking.join(' '));
}

function getS3Client() {
  assertS3Ready();
  if (!s3Client) {
    const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || '').trim();
    s3Client = new S3Client({
      region: S3_REGION,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {})
    });
  }
  return s3Client;
}

function publicUrlFor(relPath) {
  const safe = safeRelPath(relPath);
  const encoded = safe.split('/').map(encodeURIComponent).join('/');
  if (STORAGE_DRIVER === 's3') {
    if (S3_PUBLIC_BASE_URL) return `${S3_PUBLIC_BASE_URL}/${encoded}`;
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${encoded}`;
  }
  return `${PUBLIC_BASE_URL}/uploads/${encoded}`;
}

async function saveUpload(buffer, relPath, options = {}) {
  const safe = safeRelPath(relPath);
  if (STORAGE_DRIVER === 's3') {
    await getS3Client().send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: safe,
      Body: buffer,
      ContentType: options.mimeType || 'application/octet-stream'
    }));
    return {
      relPath: safe,
      absolutePath: '',
      url: publicUrlFor(safe),
      size: buffer.length,
      storageDriver: STORAGE_DRIVER
    };
  }

  ensureUploadDir();
  const target = absoluteFromRel(safe);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return {
    relPath: safe,
    absolutePath: target,
    url: publicUrlFor(safe),
    size: buffer.length,
    storageDriver: STORAGE_DRIVER
  };
}

async function deleteUpload(relPath) {
  if (!relPath) return;
  try {
    const safe = safeRelPath(relPath);
    if (STORAGE_DRIVER === 's3') {
      await getS3Client().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: safe }));
      return;
    }
    const target = absoluteFromRel(safe);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    // Best effort cleanup; callers should not fail because stale file cleanup failed.
  }
}

function resolveServePath(urlPath) {
  if (STORAGE_DRIVER !== 'local') return null;
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

function storageKeyFromUrl(urlValue) {
  const value = String(urlValue || '').trim();
  if (!value) return '';
  try {
    const parsed = value.startsWith('http://') || value.startsWith('https://')
      ? new URL(value)
      : new URL(value, 'http://local.test');

    if (parsed.pathname.startsWith('/uploads/')) {
      return safeRelPath(decodeURIComponent(parsed.pathname.replace(/^\/uploads\/+/, '')));
    }

    if (S3_PUBLIC_BASE_URL && value.startsWith(`${S3_PUBLIC_BASE_URL}/`)) {
      return safeRelPath(decodeURIComponent(value.slice(S3_PUBLIC_BASE_URL.length + 1)));
    }

    const s3Host = `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
    if (S3_BUCKET && S3_REGION && parsed.hostname === s3Host) {
      return safeRelPath(decodeURIComponent(parsed.pathname.replace(/^\/+/, '')));
    }
  } catch (error) {
    return '';
  }
  return '';
}

function getStorageDiagnostics() {
  return {
    driver: STORAGE_DRIVER,
    uploadDir: STORAGE_DRIVER === 'local' ? UPLOAD_DIR : '',
    s3: {
      bucketConfigured: Boolean(S3_BUCKET),
      regionConfigured: Boolean(S3_REGION),
      publicBaseUrlConfigured: Boolean(S3_PUBLIC_BASE_URL),
      usingIamRole: STORAGE_DRIVER === 's3' && !process.env.S3_ACCESS_KEY_ID && !process.env.S3_SECRET_ACCESS_KEY
    }
  };
}

module.exports = {
  STORAGE_DRIVER,
  UPLOAD_DIR,
  ensureUploadDir,
  saveUpload,
  deleteUpload,
  publicUrlFor,
  resolveServePath,
  storageKeyFromUrl,
  getStorageDiagnostics,
  s3ConfigWarnings
};
