'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-ar-toggle-'));
fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: s => !s.includes(path.sep + '.git') });

const dataDir = path.join(root, 'server/data');
const settingsFile = path.join(dataDir, 'site-settings.json');
const storeFile = path.join(dataDir, 'store.json');

// Seed a public article with distinct AR/EN slugs + base_url + default_language="ar" while arabic_enabled=false
const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
store.collections.articles.push({
  id: 'toggle-art',
  status: 'published',
  hidden: false,
  slug: { ar: 'مقال-تجريبي', en: 'toggle-article-en' },
  title: { ar: 'عنوان عربي', en: 'English Title' },
  excerpt: { ar: 'ملخص عربي', en: 'English Excerpt' },
  sections: [{ type: 'paragraph', ar: 'فقرة عربية', en: 'English paragraph', published: true }]
});
store.collections.articles.push({
  id: 'toggle-draft',
  status: 'draft',
  hidden: true,
  slug: { ar: 'مسودة-سرية', en: 'secret-draft' },
  title: { ar: 'مسودة', en: 'Draft' },
  sections: []
});
fs.writeFileSync(storeFile, JSON.stringify(store));
fs.writeFileSync(settingsFile, JSON.stringify({ default_language: 'ar', arabic_enabled: false, base_url: 'https://toggle.example' }));

const AR_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

(async () => {
  const port = 19461;
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port), TOR_SHOW_SAMPLES: '1' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

    // a) -ar.html -> 302 to -en.html preserving query string
    for (const p of ['/index-ar.html?x=1', '/challenges-ar.html?f=open', '/about-ar.html']) {
      const r = await fetch(base + p, { redirect: 'manual' });
      const exp = p.replace('-ar.html', '-en.html');
      check(r.status === 302 && r.headers.get('location') === exp, `302 ${p} -> ${exp}`);
    }

    // b) Detail -ar.html with ?c= / ?id=<ARABIC slug> -> 302 mapped to EN slug; draft -> 404
    const rc = await fetch(base + '/challenge-ar.html?c=log4shell-lab', { redirect: 'manual' });
    check(rc.status === 302 && rc.headers.get('location') === '/challenge-en.html?c=log4shell-lab', 'challenge-ar?c= redirects 302 to challenge-en?c=');
    const rSlug = await fetch(base + '/article-ar.html?id=' + encodeURIComponent('مقال-تجريبي'), { redirect: 'manual' });
    check(rSlug.status === 302 && rSlug.headers.get('location') === '/article-en.html?id=toggle-article-en', 'article-ar?id=<Arabic slug> maps to English slug');
    const rDraft = await fetch(base + '/article-ar.html?id=' + encodeURIComponent('مسودة-سرية'), { redirect: 'manual' });
    check(rDraft.status === 404, 'draft/hidden -ar detail returns 404');

    // c) GET / -> English even when default_language="ar"
    const rRoot = await fetch(base + '/');
    const hRoot = await rRoot.text();
    check(rRoot.status === 200 && /lang="en"/.test(hRoot), 'GET / serves English even when default_language=ar');

    // d & e) Zero Arabic-script chars, no pill-lang, no hreflang="ar", no Arabic font families on all EN pages, /content.js, and 404
    const checkPaths = [
      '/', '/index-en.html', '/challenges-en.html', '/challenge-en.html?c=log4shell-lab',
      '/articles-en.html', '/article-en.html?id=toggle-article-en',
      '/investigations-en.html', '/about-en.html',
      '/nonexistent-page', '/content.js'
    ];
    for (const cp of checkPaths) {
      const r = await fetch(base + cp, { headers: { Accept: 'text/html' } });
      const txt = await r.text();
      check(!AR_SCRIPT_RE.test(txt), `zero Arabic characters in ${cp}`);
      if (cp !== '/content.js') {
        check(!txt.includes('pill-lang') && !txt.includes('hreflang="ar"') && !/Aref\+Ruqaa|IBM\+Plex\+Sans\+Arabic|Tajawal/.test(txt), `no pill-lang, hreflang="ar", or Arabic fonts in ${cp}`);
      }
    }

    // f) /sitemap.xml has no -ar.html
    const sm = await (await fetch(base + '/sitemap.xml')).text();
    check(!sm.includes('-ar.html') && !sm.includes('hreflang="ar"') && sm.includes('toggle-article-en'), 'sitemap has only English URLs when arabic_enabled=false');

    // Setup admin & login
    await fetch(base + '/admin/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'qa-admin', password: 'qa-local-pass-1234' }) });
    const loginRes = await fetch(base + '/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'qa-admin', password: 'qa-local-pass-1234' }) });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    const loginJson = await loginRes.json();
    const csrf = loginJson.csrf;
    const admHeaders = { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf };

    // g) PUT site-settings validation, auth/CSRF, audit
    const noAuth = await fetch(base + '/admin/api/site-settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ arabic_enabled: true }) });
    check(noAuth.status === 401, 'PUT site-settings requires session');
    const badBool = await fetch(base + '/admin/api/site-settings', { method: 'PUT', headers: admHeaders, body: JSON.stringify({ arabic_enabled: 'yes' }) });
    check(badBool.status === 400, 'non-boolean arabic_enabled rejected with 400');

    // h) Toggle ON without restart -> 200 on /index-ar.html; toggle OFF -> 302 again
    const flipOn = await fetch(base + '/admin/api/site-settings', { method: 'PUT', headers: admHeaders, body: JSON.stringify({ arabic_enabled: true, default_language: 'ar', base_url: 'https://toggle.example' }) });
    check(flipOn.status === 200, 'flip arabic_enabled=true succeeds');
    const arOnRes = await fetch(base + '/index-ar.html', { redirect: 'manual' });
    check(arOnRes.status === 200 && (await arOnRes.text()).includes('lang="ar"'), 'after flip ON (no restart), /index-ar.html returns 200 Arabic');
    const auditRes = await (await fetch(base + '/admin/api/audit', { headers: { cookie } })).json();
    check(auditRes.audit.some(a => a.entity === 'arabic_enabled' && a.detail === 'Arabic site enabled'), 'audit log records Arabic site enabled');

    // i) Data preservation: create bilingual item (ON) -> flip OFF -> edit EN -> flip ON -> AR intact
    const createRes = await fetch(base + '/admin/api/articles', {
      method: 'POST', headers: admHeaders,
      body: JSON.stringify({
        id: 'preserve-1', status: 'published',
        slug: { ar: 'حفظ-عربي', en: 'preserve-en' },
        title: { ar: 'عنوان محفوظ', en: 'Initial EN' },
        excerpt: { ar: 'ملخص محفوظ', en: 'Initial EX' },
        sections: [{ type: 'paragraph', ar: 'نص عربي أصلي', en: 'Initial body' }]
      })
    });
    check(createRes.status === 200, 'created bilingual article while ON');

    await fetch(base + '/admin/api/site-settings', { method: 'PUT', headers: admHeaders, body: JSON.stringify({ arabic_enabled: false, default_language: 'ar', base_url: 'https://toggle.example' }) });
    const arOffAgain = await fetch(base + '/index-ar.html', { redirect: 'manual' });
    check(arOffAgain.status === 302, 'after flip OFF (no restart), /index-ar.html returns 302 again');

    // Edit EN only (empty/omitted AR fields) while OFF
    const editOff = await fetch(base + '/admin/api/articles/preserve-1', {
      method: 'PUT', headers: admHeaders,
      body: JSON.stringify({
        id: 'preserve-1', status: 'published',
        slug: { en: 'preserve-en' },
        title: { en: 'Updated EN Title' },
        excerpt: { en: 'Updated EX' },
        sections: [{ type: 'paragraph', en: 'Updated body' }]
      })
    });
    check(editOff.status === 200, 'edited article in EN-only mode');

    // Flip ON and verify AR fields untouched
    await fetch(base + '/admin/api/site-settings', { method: 'PUT', headers: admHeaders, body: JSON.stringify({ arabic_enabled: true, default_language: 'ar', base_url: 'https://toggle.example' }) });
    const gotArt = await (await fetch(base + '/admin/api/articles/preserve-1', { headers: { cookie } })).json();
    check(
      gotArt.article.title.ar === 'عنوان محفوظ' &&
      gotArt.article.title.en === 'Updated EN Title' &&
      gotArt.article.slug.ar === 'حفظ-عربي' &&
      gotArt.article.sections[0].ar === 'نص عربي أصلي',
      'Arabic fields preserved after editing in EN-only mode'
    );

    // j) Validators: EN title required when OFF
    const val = require('../server/validators');
    const vOffMissingEn = val.validateCollections({ articles: [{ id: 'v-1', title: { ar: 'عربي', en: '' }, excerpt: { ar: '', en: '' }, slug: { ar: '', en: 'v-1' }, sections: [] }], challenges: [] }, { arabicEnabled: false });
    check(!vOffMissingEn.ok, 'validator requires title.en when arabicEnabled=false');
    const vOffOnlyEn = val.validateCollections({ articles: [{ id: 'v-2', title: { ar: '', en: 'Only EN' }, excerpt: { ar: '', en: '' }, slug: { ar: '', en: 'v-2' }, sections: [] }], challenges: [] }, { arabicEnabled: false });
    check(vOffOnlyEn.ok, 'validator allows empty title.ar when arabicEnabled=false');

    console.log('TOTAL ' + count + ' arabic-toggle assertions passed');
  } finally {
    child.kill();
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
