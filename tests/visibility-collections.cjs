'use strict';
// Guards the v8 fix: admin-only collections must never reach the public site,
// and investigations are strictly opt-in. Disposable copy, never touches real data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { publicCollections } = require('../server/visibility');
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

// ---- unit level ----
const inv = (id, extra) => Object.assign({ id, title: { ar: 'ع', en: 'T-' + id }, summary: { ar: '', en: 'S' }, status: 'closed' }, extra);
const cols = {
  challenges: [], articles: [],
  investigations: [
    inv('pub', { visibility: 'public', private_notes: 'SECRET_NOTES', internal: 'x' }),
    inv('nodefault'),                                   // no visibility field -> private
    inv('priv', { visibility: 'private' }),
    inv('draft', { visibility: 'public', status: 'draft' }),
    inv('hidden', { visibility: 'public', hidden: true }),
    inv('open', { visibility: 'public', status: 'open' })
  ],
  kb: [{ id: 'k', title: { en: 'KB' }, status: 'published' }],
  projects: [{ id: 'p', title: { en: 'PR' }, status: 'active' }],
  categories: [{ id: 'c', name: { en: 'CAT' } }], tags: [{ id: 't', name: { en: 'TAG' } }]
};
const out = publicCollections(cols);
check(JSON.stringify(Object.keys(out).sort()) === JSON.stringify(['articles', 'challenges', 'investigations']), 'only challenges/articles/investigations are serialized');
check(JSON.stringify(out.investigations.map(x => x.id).sort()) === JSON.stringify(['open', 'pub']), 'only explicit public, non-draft, non-hidden investigations pass');
check(out.investigations.every(x => x.private_notes === undefined && x.internal === undefined && x.visibility === undefined), 'unknown/private investigation fields are stripped');
check(JSON.stringify(publicCollections(undefined)) === JSON.stringify({ challenges: [], articles: [], investigations: [] }), 'missing collections yield empty arrays');

// ---- end to end: what /content.js really ships ----
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-vis-'));
fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: src => !src.includes(path.sep + '.git') });
const storeFile = path.join(root, 'server/data/store.json');
const store = JSON.parse(fs.readFileSync(storeFile));
store.collections.investigations = [
  inv('pub', { visibility: 'public', title: { ar: 'ع', en: 'PUBLIC_CASE_SENTINEL' } }),
  inv('priv', { title: { ar: 'ع', en: 'PRIVATE_CASE_SENTINEL' } })
];
store.collections.kb = [{ id: 'k', title: { ar: 'ع', en: 'PRIVATE_KB_SENTINEL' }, status: 'published' }];
store.collections.projects = [{ id: 'p', title: { ar: 'ع', en: 'PRIVATE_PROJECT_SENTINEL' }, status: 'active' }];
fs.writeFileSync(storeFile, JSON.stringify(store));
const port = 19411;
const base = 'http://127.0.0.1:' + port;
(async () => {
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const js = await (await fetch(base + '/content.js')).text();
    check(js.includes('PUBLIC_CASE_SENTINEL'), '/content.js includes the explicitly public case file');
    check(!js.includes('PRIVATE_CASE_SENTINEL'), '/content.js omits private case files');
    check(!js.includes('PRIVATE_KB_SENTINEL') && !js.includes('PRIVATE_PROJECT_SENTINEL'), '/content.js omits kb and projects entirely');
    for (const p of ['/investigations-en.html', '/investigation-ar.html']) { const r = await fetch(base + p); check(r.status === 200, 'page served ' + p); }
    console.log('TOTAL ' + count + ' collection-visibility assertions passed');
  } finally { child.kill(); try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
