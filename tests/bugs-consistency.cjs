'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const port = 19441;
const base = 'http://127.0.0.1:' + port;
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

(async () => {
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

    const r1 = await fetch(base + '/foo/bar', { headers: { Accept: 'text/html' } });
    const h1 = await r1.text();
    check(r1.status === 404 && h1.includes('<base href="/"/>'), 'nested 404 /foo/bar returns 404.html with <base href="/">');

    console.log('TOTAL ' + count + ' bugs-consistency assertions passed');
  } finally {
    child.kill();
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
