'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const port = 19431;
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

function reqRaw(p, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.get({ hostname: '127.0.0.1', port, path: p, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
  });
}

(async () => {
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await reqRaw('/health')).status === 200) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

    // 1. CSS ETag + 304 + compression
    const css1 = await reqRaw('/style.css', { 'Accept-Encoding': 'gzip' });
    check(css1.status === 200 && css1.headers['cache-control'] === 'public, max-age=0, must-revalidate', 'CSS has must-revalidate');
    check(css1.headers['content-encoding'] === 'gzip' && css1.headers['vary'] === 'Accept-Encoding', 'CSS gzipped with Vary');
    const decodedCss = zlib.gunzipSync(css1.buf).toString('utf8');
    check(decodedCss.includes('.hero'), 'gzipped CSS decodes cleanly');
    const css304 = await reqRaw('/style.css', { 'If-None-Match': css1.headers['etag'] });
    check(css304.status === 304, 'CSS returns 304 on matching ETag');

    // 2. Brotli on /content.js
    const cjs = await reqRaw('/content.js', { 'Accept-Encoding': 'br' });
    check(cjs.status === 200 && cjs.headers['content-encoding'] === 'br', '/content.js supports brotli');
    check(zlib.brotliDecompressSync(cjs.buf).toString('utf8').includes('SITE_COLLECTIONS'), 'brotli /content.js decodes cleanly');

    // 3. Assets 30-day cache + never compressed
    const img = await reqRaw('/assets/hero.jpg', { 'Accept-Encoding': 'br, gzip' });
    check(img.status === 200 && img.headers['cache-control'] === 'public, max-age=2592000', 'assets/hero.jpg cached 30 days');
    check(!img.headers['content-encoding'], 'raster image is never compressed');
    const img304 = await reqRaw('/assets/hero.jpg', { 'If-None-Match': img.headers['etag'] });
    check(img304.status === 304, 'assets/hero.jpg returns 304 on matching ETag');

    // 4. API & Admin remain no-store
    const api = await reqRaw('/health');
    check(api.headers['cache-control'] === 'no-store', '/health remains no-store');
    const adm = await reqRaw('/admin/login.html');
    check(adm.headers['cache-control'] === 'no-store', '/admin/login.html remains no-store');

    console.log('TOTAL ' + count + ' cache-compression assertions passed');
  } finally {
    child.kill();
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
