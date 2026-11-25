'use strict';
// Ensures that with the shipped store.json and NO env vars, no placeholder or
// fabricated/demo text appears on any public page or in /content.js.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 19412;
const base = 'http://127.0.0.1:' + port;

const PAGES = [
  '/index-en.html', '/index-ar.html',
  '/challenges-en.html', '/challenges-ar.html',
  '/challenge-en.html', '/challenge-ar.html',
  '/articles-en.html', '/articles-ar.html',
  '/article-en.html', '/article-ar.html',
  '/investigations-en.html', '/investigations-ar.html',
  '/investigation-en.html', '/investigation-ar.html',
  '/about-en.html', '/about-ar.html',
  '/404.html', '/index.html',
  '/content.js'
];

const FORBIDDEN = ['to be added', 'Placeholder', 'FABRICATED', '201063358716'];
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

(async () => {
  const env = { ...process.env, TOR_PORT: String(port) };
  delete env.TOR_SHOW_SAMPLES;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base + '/health')).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    for (const p of PAGES) {
      const r = await fetch(base + p);
      assert.ok(r.status === 200, 'Expected 200 for ' + p + ', got ' + r.status);
      const body = await r.text();
      for (const word of FORBIDDEN) {
        assert.ok(!body.includes(word), `Found forbidden "${word}" in ${p}`);
      }
      check(true, 'clean ' + p);
    }
    const cvRes = await fetch(base + '/assets/Mina-Maximous-CV.pdf');
    assert.ok(cvRes.status === 200 && (cvRes.headers.get('content-type') || '').includes('application/pdf'), 'CV PDF served cleanly');
    const cvBuf = Buffer.from(await cvRes.arrayBuffer());
    assert.ok(!cvBuf.toString('latin1').includes('201063358716'), 'CV PDF contains no phone number');
    check(true, 'CV PDF served without phone number');
    console.log('TOTAL ' + count + ' no-placeholder assertions passed');
  } finally {
    child.kill();
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
