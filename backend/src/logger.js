const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(__dirname, '..', 'logs');

const ACTIVITY_LOG_PATH = path.join(LOG_DIR, 'activity.log');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'inviteToken',
  'apiKey',
  'serviceAccount',
  'stack'
]);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (REDACTED_KEYS.has(key) || REDACTED_KEYS.has(key.toLowerCase())) {
        return [key, '[redacted]'];
      }
      return [key, redact(item)];
    })
  );
}

function appendJsonLine(filePath, event, data = {}) {
  try {
    ensureLogDir();
    const payload = {
      timestamp: new Date().toISOString(),
      event,
      ...redact(data)
    };
    fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, (error) => {
      if (error) console.error('[file log failed]', error.message);
    });
  } catch (error) {
    console.error('[file log failed]', error.message);
  }
}

function logActivity(event, data = {}) {
  appendJsonLine(ACTIVITY_LOG_PATH, event, data);
}

function logError(event, error, data = {}) {
  appendJsonLine(ERROR_LOG_PATH, event, {
    ...data,
    internalMessage: error instanceof Error ? error.message : String(error || ''),
    stack: error instanceof Error ? String(error.stack || '').slice(0, 6000) : ''
  });
}

module.exports = {
  LOG_DIR,
  ACTIVITY_LOG_PATH,
  ERROR_LOG_PATH,
  logActivity,
  logError
};
