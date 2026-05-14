import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.resolve(process.cwd(), 'dist');
const assetDir = path.join(distDir, 'assets');
const sizeLimitBytes = 500 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const files = walk(assetDir)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => {
    const raw = fs.readFileSync(file);
    return {
      file: path.relative(distDir, file),
      bytes: raw.length,
      gzipBytes: zlib.gzipSync(raw).length
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

if (!files.length) {
  console.log('No JS/CSS assets found. Run npm run build first.');
  process.exit(0);
}

console.log('\nBuild asset size report');
console.log('File'.padEnd(48), 'Raw'.padStart(10), 'Gzip'.padStart(10));
console.log('-'.repeat(70));
for (const item of files) {
  console.log(item.file.padEnd(48), formatBytes(item.bytes).padStart(10), formatBytes(item.gzipBytes).padStart(10));
}

const largest = files[0];
if (largest.bytes > sizeLimitBytes) {
  console.warn(`\nWarning: largest asset is ${formatBytes(largest.bytes)} (${largest.file}). Review before production if this keeps growing.`);
}
