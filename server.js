const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'submissions.csv');

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

function resolvePath(urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  return path.join(ROOT, filePath);
}

function validateSubmission(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid submission payload.';
  if (!payload.form || (payload.form !== 'attend' && payload.form !== 'node-lead')) return 'Invalid form type.';
  if (!payload.name || !payload.email) return 'Name and email are required.';
  return null;
}

ensureDataStore();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(raw || '{}');
        const error = validateSubmission(payload);
        if (error) {
          sendJson(res, 400, { ok: false, error });
          return;
        }
        payload.submittedAt = payload.submittedAt || new Date().toISOString();
        fs.appendFile(CSV_PATH, toCsvRow(payload), (appendErr) => {
          if (appendErr) {
            sendJson(res, 500, { ok: false, error: 'Could not save submission.' });
            return;
          }
          sendJson(res, 200, { ok: true });
        });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'Malformed JSON request.' });
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const filePath = resolvePath(url.pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }
    const fallback = path.join(ROOT, 'index.html');
    if (url.pathname === '/' || path.extname(url.pathname) === '') {
      sendFile(res, fallback);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
});

server.listen(PORT, () => {
  console.log(`AI Unplugged running at http://localhost:${PORT}`);
  console.log(`Saving submissions to ${CSV_PATH}`);
});
