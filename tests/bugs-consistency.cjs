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

    const r2 = await fetch(base + '/does-not-exist.html', { headers: { Accept: 'text/html' } });
    const h2 = await r2.text();
    check(r2.status === 404 && h2.includes('error-code') && h2.includes('noindex'), 'allowlisted missing .html returns styled 404.html');

    const r3 = await fetch(base + '/admin/preview.html?kind=investigation&lang=en&id=x', { redirect: 'manual' });
    check(r3.status === 302, 'investigation preview requires admin session');

    const sjs = require('node:fs').readFileSync(path.join(root, 'script.js'), 'utf8');
    check((sjs.match(/querySelector\(['"]a?\.pill-lang['"]\)/g) || []).length === 1, 'script.js has single pill-lang handler (no duplicate)');
    check(sjs.includes('foundItem.slug[otherLang]'), 'pill-lang maps bilingual slugs across languages');

    const { clientIp } = require('../server/client-ip');
    check(clientIp({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }, true) === '5.6.7.8', 'clientIp uses LAST X-Forwarded-For entry when TRUST_PROXY=true');
    check(clientIp({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }, true) === '9.9.9.9', 'clientIp prefers X-Real-IP over X-Forwarded-For');
    check(clientIp({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '1.2.3.4, not-an-ip' } }, true) === '10.0.0.1', 'clientIp falls back to socket address on invalid XFF');
    check(clientIp({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '5.6.7.8' } }, false) === '10.0.0.1', 'clientIp ignores proxy headers when TRUST_PROXY=false');

    const idxEn = await (await fetch(base + '/index-en.html')).text();
    check(idxEn.includes('class="skip-link"') && idxEn.includes('id="main-content"') && idxEn.includes('aria-label="العربية"'), 'a11y skip-link, main-content, and pill-lang aria-label present');
    const cssText = require('node:fs').readFileSync(path.join(root, 'style.css'), 'utf8');
    check(cssText.includes('prefers-reduced-motion: reduce'), 'style.css includes prefers-reduced-motion');
    check(sjs.includes("setAttribute('scope', 'col')"), 'artifacts table headers include scope="col"');

    const validators = require('../server/validators');
    const vBad = validators.validateCollections({ articles: [{ id: 'BAD ID!' }], challenges: [] });
    check(!vBad.ok && vBad.errors.length > 0, 'validators.js rejects invalid id without vm');
    const vOk = validators.validateCollections({ articles: [{ id: 'valid-1', title: { ar: 'ع', en: 'E' }, excerpt: { ar: '', en: '' }, slug: { ar: 'ع', en: 'e' }, sections: [] }], challenges: [] });
    check(vOk.ok && vOk.value.articles[0].id === 'valid-1', 'validators.js accepts valid article');

    const admJs = require('node:fs').readFileSync(path.join(root, 'server/admin.js'), 'utf8');
    check(!admJs.includes('content.js.tmp'), 'admin.js publishStore does not write back to content.js');

    const os = require('node:os');
    const customData = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'tor-data-'));
    const portData = 19442;
    const childData = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(portData), TOR_DATA_DIR: customData }, stdio: 'ignore' });
    try {
      for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:' + portData + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
      await fetch('http://127.0.0.1:' + portData + '/content.js');
      check(require('node:fs').existsSync(path.join(customData, 'store.json')), 'TOR_DATA_DIR seeds store.json into custom directory');
    } finally {
      childData.kill();
      try { require('node:fs').rmSync(customData, { recursive: true, force: true }); } catch {}
    }

    console.log('TOTAL ' + count + ' bugs-consistency assertions passed');
  } finally {
    child.kill();
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
