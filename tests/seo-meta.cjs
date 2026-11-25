'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-seo-'));
fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: s => !s.includes(path.sep + '.git') });

const storeFile = path.join(root, 'server/data/store.json');
const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
store.collections.articles.push({
  id: 'seo-xss-art',
  status: 'published',
  hidden: false,
  date: '2026-11-20',
  slug: { en: 'seo-xss-en', ar: 'seo-xss-ar' },
  title: { en: 'Alert <script>"& Test', ar: 'تنبيه <script>"& اختبار' },
  excerpt: { en: 'Summary <b>bold</b> text', ar: 'ملخص <b>نص</b>' },
  sections: []
});
store.collections.articles.push({
  id: 'hidden-art',
  status: 'draft',
  hidden: true,
  title: { en: 'Secret Draft', ar: 'مسودة سرية' },
  sections: []
});
fs.writeFileSync(storeFile, JSON.stringify(store));

const settingsFile = path.join(root, 'server/data/site-settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ default_language: 'en', base_url: 'https://example.test' }));

let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

(async () => {
  const port = 19421;
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port), TOR_SHOW_SAMPLES: '1' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

    // 1. Public item with base_url
    const r1 = await fetch(base + '/article-en.html?id=seo-xss-en');
    const h1 = await r1.text();
    check(r1.status === 200, 'public detail page returns 200');
    check(h1.includes('<title>Alert &lt;script&gt;&quot;&amp; Test'), 'title escaped in HTML');
    check(h1.includes('rel="canonical" href="https://example.test/article-en.html?id=seo-xss-en"'), 'canonical injected');
    check(h1.includes('hreflang="ar" href="https://example.test/article-ar.html?id=seo-xss-ar"'), 'hreflang ar uses Arabic slug');
    check(h1.includes('hreflang="x-default" href="https://example.test/article-en.html?id=seo-xss-en"'), 'hreflang x-default points to EN');
    check(h1.includes('property="og:title"') && h1.includes('property="og:url"') && h1.includes('property="og:image"'), 'og tags injected');
    check(h1.includes('application/ld+json') && h1.includes('\\u003cscript'), 'JSON-LD escapes < as \\u003c');

    // 2. Unknown item -> 404 + noindex
    const r2 = await fetch(base + '/challenge-en.html?c=nonexistent-id');
    const h2 = await r2.text();
    check(r2.status === 404 && h2.includes('noindex'), 'unknown id returns 404 + noindex');

    // 3. Hidden/draft item -> 404 + noindex
    const r3 = await fetch(base + '/article-en.html?id=hidden-art');
    const h3 = await r3.text();
    check(r3.status === 404 && h3.includes('noindex'), 'hidden/draft id returns 404 + noindex');

    // 4. Without base_url -> no canonical / og:url
    fs.writeFileSync(settingsFile, JSON.stringify({ default_language: 'en' }));
    const r4 = await fetch(base + '/article-en.html?id=seo-xss-en');
    const h4 = await r4.text();
    check(r4.status === 200 && !h4.includes('rel="canonical"') && !h4.includes('property="og:url"') && h4.includes('Alert &lt;script&gt;'), 'without base_url: title injected, no canonical/og:url');

    // 5. Static page meta: stripped when no base_url, substituted when base_url is set
    const r5 = await fetch(base + '/challenges-en.html');
    const h5 = await r5.text();
    check(!h5.includes('mina-max.website') && !h5.includes('rel="canonical"') && h5.includes('property="og:title"'), 'static page strips canonical/og:url when base_url empty');
    fs.writeFileSync(settingsFile, JSON.stringify({ default_language: 'en', base_url: 'https://custom.example' }));
    const r6 = await fetch(base + '/challenges-en.html');
    const h6 = await r6.text();
    check(h6.includes('https://custom.example/challenges-en.html') && h6.includes('hreflang="x-default"') && !h6.includes('mina-max.website'), 'static page substitutes base_url and has x-default');

    console.log('TOTAL ' + count + ' seo-meta assertions passed');
  } finally {
    child.kill();
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
