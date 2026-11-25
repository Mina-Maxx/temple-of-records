// The Temple of Records — local flag-verification + solve-record service (DEMO GRADE)
// Node.js standard library only. No dependencies.
//
// Runs the static site AND the flag API with one command:
//     node server/server.js      ->  http://127.0.0.1:8000
//
// Honest limits (also in README.txt):
// - Local demo server bound to 127.0.0.1, no TLS, in-memory rate limits.
//   It is NOT production hosting and NOT hardened for the public internet.
// - Flags live only here (salted SHA-256 in flags.json). Clients never receive them.
// - Solve records persist in server/data/solves.json keyed by an anonymous
//   browser-generated identity token. Same-browser progress also works fully
//   offline; cross-device continuity needs real accounts later.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('./admin');
const seo = require('./seo');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const SOLVES_FILE = path.join(DATA_DIR, 'solves.json');
const FLAGS_FILE_PATH = path.join(__dirname, 'flags.json');
// Re-read per request: flag set/replace and policy changes in the admin panel apply live, no restart.
function loadFlags() {
  try { return JSON.parse(fs.readFileSync(FLAGS_FILE_PATH, 'utf8')); } catch (e) { return {}; }
}
const PLAYERS_STATE_FILE = path.join(DATA_DIR, 'players_state.json');
const PLAYER_NAMES_FILE = path.join(DATA_DIR, 'players_names.json');
function loadPlayerNames() {
  try { return JSON.parse(fs.readFileSync(PLAYER_NAMES_FILE, 'utf8')); } catch (e) { return {}; }
}
function savePlayerName(identity, name) {
  if (!identity || !name) return;
  const names = loadPlayerNames();
  names[identity] = name;
  const tmp = PLAYER_NAMES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(names, null, 1));
  fs.renameSync(tmp, PLAYER_NAMES_FILE);
}
function isDisabled(identity) {
  try { const st = JSON.parse(fs.readFileSync(PLAYERS_STATE_FILE, 'utf8')); return (st.disabled || []).includes(identity); } catch (e) { return false; }
}

const HOST = process.env.TOR_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
// Deployment switches:
//   PORT               cloud providers (Render, Koyeb) inject PORT; binds to 0.0.0.0 automatically
//   TOR_HTTPS=1        site is served over HTTPS by a proxy: Secure cookie + HSTS
//   TOR_TRUST_PROXY=1  proxy sets X-Real-IP; use it for rate limits
//   TOR_DEV_CORS=1     allow cross-origin API calls (only for the file:// preview)
const HTTPS_MODE = process.env.TOR_HTTPS === '1' || process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TOR_TRUST_PROXY === '1' || !!process.env.PORT;
const DEV_CORS = process.env.TOR_DEV_CORS === '1';
const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
function clientIp(req) {
  const raw = req.socket.remoteAddress || 'unknown';
  if (TRUST_PROXY) {
    const v = String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
    if (/^[0-9a-fA-F:.]{3,45}$/.test(v)) return v;
  }
  return raw;
}
const PORT = Number(process.env.PORT || process.env.TOR_PORT || 8000);

const MAX_BODY = 4096;
const RATE_WINDOW_MS = 60_000;
const RATE_PER_IDENTITY_CHALLENGE = 5;
const RATE_PER_IP = 60;
const RATE_PER_IP_CHALLENGE = 20;

// ---------- solve store ----------
let solves = {};
try { solves = JSON.parse(fs.readFileSync(SOLVES_FILE, 'utf8')); } catch (e) { solves = {}; }
function saveSolves() {
  const tmp = SOLVES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(solves, null, 1));
  fs.renameSync(tmp, SOLVES_FILE);
}

// ---------- rate limiting (in-memory sliding windows) ----------
const hits = new Map(); // key -> [timestamps]
function rateOk(key, limit) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) { // crude bound
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > RATE_WINDOW_MS) hits.delete(k);
  }
  return true;
}

// ---------- helpers ----------
function json(res, code, obj, cors) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(cors && DEV_CORS ? { 'Access-Control-Allow-Origin': '*' } : {})
  });
  res.end(body);
}
function hashFlag(salt, flag) {
  return crypto.createHash('sha256').update(salt + flag, 'utf8').digest();
}
const ID_RE = /^[a-f0-9]{32}$/;

function handleApi(req, res, url, ip) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, DEV_CORS ? {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600'
    } : {});
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', uptime: Math.floor(process.uptime()) }, true);
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const identity = url.searchParams.get('identity') || '';
    if (!ID_RE.test(identity)) return json(res, 400, { error: 'bad_identity' }, true);
    const mine = solves[identity] || {};
    const names = loadPlayerNames();
    return json(res, 200, { solved: Object.keys(mine).filter(id => admin.challengeIsPublic(id)), name: names[identity] || '' }, true);
  }

  if (url.pathname === '/api/solvers' && req.method === 'GET') {
    const challenge = url.searchParams.get('challenge');
    const names = loadPlayerNames();
    if (challenge) {
      if (!admin.challengeIsPublic(challenge)) return json(res, 404, { error: 'unknown_challenge' }, true);
      const list = [];
      Object.keys(solves).forEach(id => {
        if (solves[id] && solves[id][challenge]) {
          list.push({
            name: names[id] || 'Anonymous',
            ts: solves[id][challenge]
          });
        }
      });
      list.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      return json(res, 200, { challenge, solvers: list }, true);
    }
    const all = {};
    Object.keys(solves).forEach(id => {
      const pSolves = solves[id] || {};
      Object.keys(pSolves).forEach(chId => {
        if (!admin.challengeIsPublic(chId)) return;
        if (!all[chId]) all[chId] = [];
        all[chId].push({
          name: names[id] || 'Anonymous',
          ts: pSolves[chId]
        });
      });
    });
    Object.keys(all).forEach(chId => {
      all[chId].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    });
    return json(res, 200, { solvers: all }, true);
  }

  if (url.pathname === '/api/submit' && req.method === 'POST') {
    if (!rateOk('ip:' + ip, RATE_PER_IP)) return json(res, 429, { error: 'rate_limited' }, true);
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > MAX_BODY) { req.destroy(); }
    });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'bad_json' }, true); }
      const identity = String(data.identity || '');
      const name = String(data.name || '').trim().slice(0, 50) || 'Anonymous';
      const challenge = String(data.challenge || '');
      const flag = String(data.flag || '').trim();
      if (!ID_RE.test(identity)) return json(res, 400, { error: 'bad_identity' }, true);
      if (isDisabled(identity)) { return json(res, 403, { error: 'player_disabled' }, true); }
      const flagsNow = loadFlags();
      const rec = flagsNow[challenge];
      if (!rec || challenge === '_policy' || !admin.challengeIsOpen(challenge)) return json(res, 404, { error: 'unknown_challenge' }, true);
      if (!flag || flag.length > 200) return json(res, 400, { error: 'bad_flag' }, true);
      if (!rateOk('sub:' + identity + ':' + challenge, RATE_PER_IDENTITY_CHALLENGE)) {
        return json(res, 429, { error: 'rate_limited' }, true);
      }
      // anonymous tokens are free to mint, so also cap per IP+challenge: friction, not proof
      if (!rateOk('subip:' + ip + ':' + challenge, RATE_PER_IP_CHALLENGE)) {
        return json(res, 429, { error: 'rate_limited' }, true);
      }
      const logSub = (result) => {
        const rec2 = {
          id: crypto.randomBytes(8).toString('hex'), ts: new Date().toISOString(),
          identity, name, challenge, result,
          flag_masked: flag.slice(0, 3) + '\u2026(' + flag.length + ')',
          ip_hash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
        };
        fs.appendFileSync(path.join(DATA_DIR, 'submissions.jsonl'), JSON.stringify(rec2) + '\n');
      };
      solves[identity] = solves[identity] || {};
      if (solves[identity][challenge]) {
        if (name && name !== 'Anonymous') savePlayerName(identity, name);
        logSub('already');
        return json(res, 200, { status: 'already', name }, true);
      }
      const expect = Buffer.from(rec.sha256, 'hex');
      const policy = flagsNow._policy || {};
      const cand = policy.case_sensitive === false ? flag.toLowerCase() : flag;
      const got = hashFlag(rec.salt, cand);
      if (expect.length === got.length && crypto.timingSafeEqual(expect, got)) {
        solves[identity][challenge] = new Date().toISOString();
        saveSolves();
        if (name) savePlayerName(identity, name);
        logSub('correct');
        return json(res, 200, { status: 'correct', points: admin.challengePoints(challenge), name }, true);
      }
      logSub('wrong');
      return json(res, 200, { status: 'wrong' }, true);
    });
    return;
  }

  return json(res, 404, { error: 'not_found' }, true);
}

// ---------- static site ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.pcap': 'application/vnd.tcpdump.pcap'
};
function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end('bad path'); }
  if (p === '/admin' || p === '/admin/') { res.writeHead(302, { Location: '/admin/index.html' }); return res.end(); }
  if (p === '/content.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(admin.publicContentScript());
  }
  // Explicit static surface: no server files, backups, dotfiles or test fixtures.
  const allowed = /^\/(?!admin\.html$)[a-z0-9][a-z0-9-]*\.html$/.test(p) || ['/', '/script.js', '/style.css'].includes(p) || /^\/admin\/[a-z][a-z0-9-]*\.(html|js|css)$/.test(p) || /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpg|jpeg|png|gif|webp|svg|woff2?)$/.test(p);
  if (!allowed) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      try {
        const err404 = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(err404);
      } catch (e) {}
    }
    res.writeHead(404); return res.end('not found');
  }
  if (p.startsWith('/artifacts/')) { res.writeHead(403); return res.end('forbidden'); } // internal test fixture, not hosted evidence
  // admin HTML pages (except login) require a session; assets stay public
  if (/^\/admin\/(?!login\.html$|recovery\.html$).+\.html$/.test(p)) {
    const m = /(?:^|;\s*)tor_admin=([a-f0-9]{48})/.exec(req.headers.cookie || '');
    let ok = false;
    if (m) {
      try {
        const sessions = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'data', 'sessions.json'), 'utf8'));
        ok = !!(sessions[m[1]] && sessions[m[1]].exp > Date.now());
      } catch (e) { ok = false; }
    }
    if (!ok) {
      res.writeHead(302, { Location: '/admin/login.html' });
      return res.end();
    }
  }
  if(p==='/admin/preview.html'){
    const kind=url.searchParams.get('kind')==='article'?'article':'challenge';const lang=url.searchParams.get('lang')==='en'?'en':'ar';
    let html=fs.readFileSync(path.join(ROOT,kind+'-'+lang+'.html'),'utf8').replace('<head>','<head><base href="/">').replace('<script src="content.js"></script>','<script src="/admin/api/preview-content"></script>');
    html=html.replace('<body','<body data-admin-preview="true"');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);
  }
  if (p === '/' || p === '/index.html') {let cfg={};try{cfg=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'site-settings.json'),'utf8'))}catch{}p=cfg.default_language==='ar'?'/index-ar.html':'/index-en.html';}
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  if (file.startsWith(path.join(ROOT, 'server') + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    if (path.extname(file).toLowerCase() === '.html') {
      const rawHtml = fs.readFileSync(file, 'utf8');
      const resMeta = /^\/(article|challenge|investigation)-(ar|en)\.html$/.test(p)
        ? seo.injectDetailMeta(rawHtml, p, url, ROOT, DATA_DIR)
        : { status: 200, html: seo.injectStaticMeta(rawHtml, DATA_DIR) };
      const buf = Buffer.from(resMeta.html, 'utf8');
      res.writeHead(resMeta.status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': buf.length,
        'Cache-Control': 'no-store'
      });
      return res.end(buf);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (HTTPS_MODE) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const ip = clientIp(req);
  if(url.pathname==='/sitemap.xml'){
    let cfg={};try{cfg=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'site-settings.json'),'utf8'))}catch{}
    if(!cfg.base_url){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Configure a real HTTPS site origin in admin settings first.');}
    const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const pages=['index','challenges','articles','about'].flatMap(p=>['ar','en'].map(l=>p+'-'+l+'.html'));
    let collections={};try{collections=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'store.json'),'utf8')).collections||{}}catch{}
    const visible=require('./visibility').publicCollections(collections);if((visible.investigations||[]).length)['ar','en'].forEach(l=>pages.push('investigations-'+l+'.html'));for(const [key,page] of [['articles','article'],['challenges','challenge'],['investigations','investigation']])for(const item of visible[key]||[])for(const l of ['ar','en'])pages.push(page+'-'+l+'.html?id='+encodeURIComponent(item.slug&&item.slug[l]||item.id));
    res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8'});return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(p=>'<url><loc>'+esc(cfg.base_url+'/'+p)+'</loc></url>').join('')+'</urlset>');
  }
  if (url.pathname === '/health' || url.pathname.startsWith('/api/')) return handleApi(req, res, url, ip);
  if (url.pathname.startsWith('/admin/api/')) {
    Promise.resolve(admin.handle(req, res, url, ip)).catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
      console.error('admin api error:', e.message);
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Temple of Records demo server: http://${HOST}:${PORT}`);
  console.log('Static site + flag API. Local demo only — not production hosting.');
});
