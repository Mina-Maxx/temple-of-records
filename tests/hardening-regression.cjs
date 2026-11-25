'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Minimal valid 1x1 PNG (matches MAGIC PNG check in server/admin.js)
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);
// Minimal valid JPEG (SOI + APP0 + EOI, matches MAGIC jpg check in server/admin.js)
const TINY_JPG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

(async () => {
  const port = 18000 + Math.floor(Math.random() * 15000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-harden-'));
  fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: s => !s.includes('/cloud') && !s.includes('\\cloud') && !s.includes('.git') });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-harden-data-'));
  const flagsFile = path.join(dataDir, 'flags.json');
  fs.copyFileSync(path.join(root, 'server', 'flags.json'), flagsFile);

  const indexEnPath = path.join(root, 'index-en.html');
  const indexEnBefore = fs.readFileSync(indexEnPath, 'utf8');
  const assetList = fs.readdirSync(path.join(root, 'assets')).filter(f => /\.jpe?g$/i.test(f));
  assert(assetList.length > 0, 'repo has at least one JPG asset in assets/');
  const builtinAssetName = assetList[0];
  const builtinAssetBefore = fs.readFileSync(path.join(root, 'assets', builtinAssetName));

  const proc = spawn(process.execPath, [path.join(root, 'server', 'server.js')], {
    cwd: root,
    env: {
      ...process.env,
      TOR_PORT: String(port),
      TOR_DATA_DIR: dataDir,
      TOR_FLAGS_FILE: flagsFile
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let srvErr = '';
  proc.stderr.on('data', d => { srvErr += d.toString(); });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server timeout: ' + srvErr)), 8000);
    proc.stdout.on('data', d => {
      if (d.toString().includes('http://')) { clearTimeout(t); res(); }
    });
  });

  const base = 'http://127.0.0.1:' + port;
  let passed = 0;
  function check(cond, msg) {
    assert(cond, msg);
    passed++;
    console.log('PASS', msg);
  }

  let cookie = '', csrf = '';
  const api = async (p, o = {}) => {
    const h = { ...(o.headers || {}) };
    if (cookie) h.Cookie = cookie;
    if (csrf && o.method && o.method !== 'GET') h['x-csrf-token'] = csrf;
    if (o.body && !h['Content-Type']) h['Content-Type'] = 'application/json';
    const r = await fetch(base + p, { ...o, headers: h });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch (e) {}
    return { status: r.status, headers: r.headers, text: t, j };
  };

  try {
    // 1. Setup & Login -> hashed session keys + timing equalized invalid username login
    let r = await api('/admin/api/setup', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'StrongPassword123!' }) });
    check(r.status === 200, 'admin setup succeeds');

    r = await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ username: 'wronguser', password: 'WrongPassword123!' }) });
    check(r.status === 401, 'wrong username rejected with 401');

    r = await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'StrongPassword123!' }) });
    check(r.status === 200 && r.j.csrf, 'admin login succeeds');
    csrf = r.j.csrf;
    cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    const tokenVal = cookie.split('=')[1];
    const tokenHash = crypto.createHash('sha256').update(tokenVal, 'utf8').digest('hex');

    const sessOnDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8'));
    check(!sessOnDisk[tokenVal] && !!sessOnDisk[tokenHash], 'sessions.json stores SHA-256 hash of session token, not plaintext');

    // 2. Strict public CSP vs admin CSP
    const pubHtmlRes = await fetch(base + '/index-en.html');
    const pubCsp = pubHtmlRes.headers.get('content-security-policy') || '';
    const scriptDirective = (pubCsp.split(';').find(d => d.trim().startsWith('script-src')) || '').trim();
    check(scriptDirective === "script-src 'self'", 'public CSP enforces strict script-src without unsafe-inline: ' + scriptDirective);

    const admHtmlRes = await fetch(base + '/admin/login.html');
    const admCsp = admHtmlRes.headers.get('content-security-policy') || '';
    const admScriptDirective = (admCsp.split(';').find(d => d.trim().startsWith('script-src')) || '').trim();
    check(admScriptDirective.includes("'unsafe-inline'"), 'admin CSP keeps unsafe-inline for admin UI');

    // 3. Media writes ONLY to TOR_DATA_DIR/assets, never ROOT/assets
    r = await api('/admin/api/media', {
      method: 'POST',
      body: JSON.stringify({ name: 'unit-upload.png', data_b64: TINY_PNG.toString('base64') })
    });
    check(r.status === 200 && r.j.status === 'uploaded', 'upload custom PNG succeeds');
    check(fs.existsSync(path.join(dataDir, 'assets', 'unit-upload.png')), 'uploaded asset written inside TOR_DATA_DIR/assets');
    check(!fs.existsSync(path.join(root, 'assets', 'unit-upload.png')), 'ROOT/assets remains untouched by upload');

    const uploadedServed = Buffer.from(await (await fetch(base + '/assets/unit-upload.png')).arrayBuffer());
    check(uploadedServed.equals(TINY_PNG), 'GET /assets/unit-upload.png serves uploaded file from TOR_DATA_DIR/assets');

    // Built-in delete blocked; override stored in DATA_DIR; delete restores built-in
    r = await api('/admin/api/media/' + encodeURIComponent(builtinAssetName), { method: 'DELETE' });
    check(r.status === 403 && r.j.error === 'builtin_asset', 'cannot delete read-only built-in asset directly');

    r = await api('/admin/api/media', {
      method: 'POST',
      body: JSON.stringify({ name: builtinAssetName, data_b64: TINY_JPG.toString('base64'), replace: true })
    });
    check(r.status === 200 && r.j.status === 'replaced' && r.j.overridden === true, 'overriding built-in writes override into TOR_DATA_DIR/assets');
    check(fs.readFileSync(path.join(root, 'assets', builtinAssetName)).equals(builtinAssetBefore), 'built-in file in ROOT/assets unchanged during override');

    const overriddenServed = Buffer.from(await (await fetch(base + '/assets/' + encodeURIComponent(builtinAssetName))).arrayBuffer());
    check(overriddenServed.equals(TINY_JPG), 'GET /assets/ serves override from TOR_DATA_DIR/assets');

    r = await api('/admin/api/media/' + encodeURIComponent(builtinAssetName), { method: 'DELETE' });
    check(r.status === 200 && r.j.status === 'restored', 'deleting override restores original built-in asset');
    const restoredServed = Buffer.from(await (await fetch(base + '/assets/' + encodeURIComponent(builtinAssetName))).arrayBuffer());
    check(restoredServed.equals(builtinAssetBefore), 'GET /assets/ serves original built-in after override deletion');

    // Reference check across store.json protects custom uploads unless x-force: 1
    r = await api('/admin/api/articles', {
      method: 'POST',
      body: JSON.stringify({
        id: 'media-ref-article',
        slug: { en: 'media-ref-article' },
        title: { en: 'Media Ref Test' },
        excerpt: { en: 'Uses uploaded asset' },
        category: { en: 'Test' },
        date: '2026-01-01',
        status: 'published',
        image: 'assets/unit-upload.png',
        sections: [{ type: 'paragraph', en: 'Body' }]
      })
    });
    check(r.status === 200, 'article referencing uploaded media created');

    r = await api('/admin/api/media/unit-upload.png', { method: 'DELETE' });
    check(r.status === 409 && r.j.error === 'referenced' && r.j.refs.includes('store.json'), 'referenced custom asset in store.json blocks accidental delete');
    r = await api('/admin/api/media/unit-upload.png', { method: 'DELETE', headers: { 'x-force': '1' } });
    check(r.status === 200 && r.j.status === 'deleted', 'x-force deletes custom uploaded asset');

    // 4. Dynamic SEO saved to DATA_DIR/seo.json without duplicating meta tags or editing ROOT HTML
    const uniqueSeoDesc = 'Custom Dynamic SEO Description 9944';
    const uniqueSeoKw = 'dfir, forensics, dynamic-seo';
    r = await api('/admin/api/seo', {
      method: 'PUT',
      body: JSON.stringify({
        en: { description: uniqueSeoDesc, keywords: uniqueSeoKw },
        ar: { description: 'وصف مخصص', keywords: 'تحقيق' }
      })
    });
    check(r.status === 200 && r.j.pages === 5, 'SEO save succeeds cleanly without mutating code dir');
    check(fs.readFileSync(indexEnPath, 'utf8') === indexEnBefore, 'ROOT/index-en.html on disk remains completely unmodified');

    const seoHtml = await (await fetch(base + '/index-en.html')).text();
    const descMatches = seoHtml.match(/<meta[^>]+name="description"[^>]*>/gi) || [];
    const ogDescMatches = seoHtml.match(/<meta[^>]+property="og:description"[^>]*>/gi) || [];
    const kwMatches = seoHtml.match(/<meta[^>]+name="keywords"[^>]*>/gi) || [];
    check(descMatches.length === 1 && descMatches[0].includes(uniqueSeoDesc), 'rendered HTML has exactly 1 updated meta description tag (no duplicates)');
    check(ogDescMatches.length === 1 && ogDescMatches[0].includes(uniqueSeoDesc), 'rendered HTML has exactly 1 updated og:description tag (no duplicates)');
    check(kwMatches.length === 1 && kwMatches[0].includes(uniqueSeoKw), 'rendered HTML has meta keywords tag');

    // 5. scrypt flag storage + verification + X-TOR-Identity header
    r = await api('/admin/api/challenges', {
      method: 'POST',
      body: JSON.stringify({
        id: 'scrypt-lab',
        slug: { en: 'scrypt-lab' },
        title: { en: 'Scrypt Lab' },
        excerpt: { en: 'Tests scrypt flag hashing' },
        category: { en: 'Misc' },
        difficulty: { en: 'Easy' },
        status: 'published',
        availability: 'open',
        date: '2026-01-01',
        sections: [
          { type: 'paragraph', zone: 'main', published: true, en: 'Solve me' },
          { type: 'paragraph', zone: 'solution', published: true, en: 'Walkthrough content' }
        ]
      })
    });
    check(r.status === 200, 'new challenge created cleanly');

    const secretFlag = 'TOR{scrypt_verified_ok}';
    r = await api('/admin/api/challenges/scrypt-lab/flag', { method: 'PUT', body: JSON.stringify({ flag: secretFlag }) });
    check(r.status === 200 && r.j.algo === 'scrypt', 'flag API reports scrypt algorithm');
    const diskFlags = JSON.parse(fs.readFileSync(flagsFile, 'utf8'));
    check(diskFlags['scrypt-lab'].algo === 'scrypt' && typeof diskFlags['scrypt-lab'].scrypt === 'string' && !diskFlags['scrypt-lab'].sha256 && diskFlags['scrypt-lab'].points === undefined, 'flags.json persists scrypt hash without plaintext, sha256, or points');

    const playerId = '0123456789abcdef0123456789abcdef';
    const xssName = '<b id="x">H4x</b> & "Dev"';
    const subRes = await (await fetch(base + '/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: playerId, challenge: 'scrypt-lab', flag: secretFlag, name: xssName })
    })).json();
    check(subRes.status === 'correct', 'POST /api/submit verifies scrypt flag');

    // Use X-TOR-Identity header (no query param)
    const stateHdrRes = await (await fetch(base + '/api/state', { headers: { 'X-TOR-Identity': playerId } })).json();
    check(stateHdrRes.solved.includes('scrypt-lab') && stateHdrRes.name === xssName, 'GET /api/state works via X-TOR-Identity header');

    const solHdrRes = await (await fetch(base + '/api/solution?challenge=scrypt-lab', { headers: { 'X-TOR-Identity': playerId } })).json();
    check(Array.isArray(solHdrRes.sections) && solHdrRes.sections.length === 1, 'GET /api/solution works via X-TOR-Identity header');

    // Concurrent admin PUTs complete cleanly without losing updates or crashing
    const [p1, p2] = await Promise.all([
      api('/admin/api/articles/media-ref-article', {
        method: 'PUT',
        body: JSON.stringify({
          slug: { en: 'media-ref-article' },
          title: { en: 'Concurrent Update 1' },
          excerpt: { en: 'Updated 1' },
          category: { en: 'Test' },
          date: '2026-01-01',
          status: 'published',
          sections: [{ type: 'paragraph', en: 'Body 1' }]
        })
      }),
      api('/admin/api/articles/media-ref-article', {
        method: 'PUT',
        body: JSON.stringify({
          slug: { en: 'media-ref-article' },
          title: { en: 'Concurrent Update 2' },
          excerpt: { en: 'Updated 2' },
          category: { en: 'Test' },
          date: '2026-01-01',
          status: 'published',
          sections: [{ type: 'paragraph', en: 'Body 2' }]
        })
      })
    ]);
    check(p1.status === 200 && p2.status === 200, 'concurrent admin edits succeed without crash');
  } finally {
    proc.kill();
    await new Promise(r => proc.once('exit', r));
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log('TOTAL', passed, 'hardening assertions passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
