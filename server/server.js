// The Temple of Records — local flag-verification + solve-record service (DEMO GRADE)
// Node.js standard library only. No dependencies.
//
// Runs the static site AND the flag API with one command:
//     node server/server.js      ->  http://127.0.0.1:8000
//
// Honest limits (also in README.md):
// - Local demo server bound to 127.0.0.1, no TLS, in-memory rate limits.
//   It is NOT production hosting and NOT hardened for the public internet.
// - Flags live only here (salted scrypt in flags.json, with legacy SHA-256 support). Clients never receive them.
// - Solve records persist in server/data/solves.json keyed by an anonymous
//   browser-generated identity token. Same-browser progress also works fully
//   offline; cross-device continuity needs real accounts later.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { readJsonCached, writeJsonAtomic, appendLogRotating } = require('./json-cache');
const { publicCollections, solutionsGated } = require('./visibility');
const admin = require('./admin');
const seo = require('./seo');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.TOR_DATA_DIR ? path.resolve(process.env.TOR_DATA_DIR) : path.join(__dirname, 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'assets');
const SITE_SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
const SOLVES_FILE = path.join(DATA_DIR, 'solves.json');
const FLAGS_FILE_PATH = process.env.TOR_FLAGS_FILE ? path.resolve(process.env.TOR_FLAGS_FILE) : path.join(__dirname, 'flags.json');
// Re-read via stat-invalidated cache: flag set/replace and policy changes apply live, no restart.
function loadFlags() { return readJsonCached(FLAGS_FILE_PATH, {}); }
const PLAYERS_STATE_FILE = path.join(DATA_DIR, 'players_state.json');
const PLAYER_NAMES_FILE = path.join(DATA_DIR, 'players_names.json');
const VERIFIED_FILE = path.join(DATA_DIR, 'verified.json');
let verified = readJsonCached(VERIFIED_FILE, {});
function saveVerified() { writeJsonAtomic(VERIFIED_FILE, verified); }
function loadPlayerNames() { return readJsonCached(PLAYER_NAMES_FILE, {}); }
// Public names are free text typed by strangers: strip control / bidi-override / zero-width
// characters, drop URLs, collapse whitespace, cap at 50 chars. Applied on input AND on output
// (so names stored before this check are sanitised too).
const NAME_STRIP_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
function cleanName(raw) {
  let n = String(raw == null ? '' : raw).replace(NAME_STRIP_RE, '');
  n = n.replace(/(?:https?:\/\/|www\.)\S+/gi, '');
  return n.replace(/\s+/g, ' ').trim().slice(0, 50).trim();
}
function playerDisplayName(rec) {
  if (!rec) return 'Anonymous';
  if (typeof rec === 'string') return cleanName(rec) || 'Anonymous';
  if (rec.hide) return 'Anonymous';
  return cleanName(rec.name) || 'Anonymous';
}
function savePlayerName(identity, name) {
  if (!identity || !name) return;
  const names = structuredClone(loadPlayerNames());
  names[identity] = name;
  writeJsonAtomic(PLAYER_NAMES_FILE, names);
}
function isDisabled(identity) {
  const st = readJsonCached(PLAYERS_STATE_FILE, {});
  return Array.isArray(st.disabled) && st.disabled.includes(identity);
}

const HOST = process.env.TOR_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
// Deployment switches:
//   PORT                 cloud providers (Render, Koyeb) inject PORT; binds to 0.0.0.0 automatically
//   TOR_HTTPS=1          site is served over HTTPS by a proxy: Secure cookie + HSTS
//   TOR_TRUST_PROXY=1/0  override proxy header trust (auto-enabled with PORT unless explicitly 0)
//   TOR_DEV_CORS=1       allow cross-origin API calls (only for the file:// preview)
const HTTPS_MODE = process.env.TOR_HTTPS === '1' || process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TOR_TRUST_PROXY === '1' || (process.env.TOR_TRUST_PROXY !== '0' && !!process.env.PORT);
const DEV_CORS = process.env.TOR_DEV_CORS === '1';
const { clientIp: resolveClientIp } = require('./client-ip');
function clientIp(req) { return resolveClientIp(req, TRUST_PROXY); }
const PORT = Number(process.env.PORT || process.env.TOR_PORT || 8000);

const MAX_BODY = 4096;
const RATE_WINDOW_MS = 60_000;
const RATE_PER_IDENTITY_CHALLENGE = 5;
const RATE_PER_IP = 60;
const RATE_PER_IP_CHALLENGE = 20;

// ---------- solve store ----------
let solves = readJsonCached(SOLVES_FILE, {});
function saveSolves() { writeJsonAtomic(SOLVES_FILE, solves); }

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
function hashFlagSha256(salt, flag) {
  return crypto.createHash('sha256').update(salt + flag, 'utf8').digest();
}
function verifyFlagRecord(rec, cand) {
  if (!rec || typeof rec.salt !== 'string') return false;
  if (typeof rec.scrypt === 'string' && rec.scrypt) {
    const expect = Buffer.from(rec.scrypt, 'hex');
    const got = crypto.scryptSync(cand, rec.salt, 32);
    return expect.length === got.length && crypto.timingSafeEqual(expect, got);
  }
  if (typeof rec.sha256 === 'string' && rec.sha256) {
    const expect = Buffer.from(rec.sha256, 'hex');
    const got = hashFlagSha256(rec.salt, cand);
    return expect.length === got.length && crypto.timingSafeEqual(expect, got);
  }
  return false;
}
function getRequestIdentity(req, url) {
  return String(req.headers['x-tor-identity'] || url.searchParams.get('identity') || '');
}
const ID_RE = /^[a-f0-9]{32}$/;

function readJsonBody(req, res, limit, onJson) {
  const chunks = [];
  let bytes = 0, tooBig = false, handled = false;
  req.on('data', c => {
    bytes += c.length;
    if (bytes > limit) {
      tooBig = true;
      chunks.length = 0;
      if (bytes > limit * 4) req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (handled) return;
    handled = true;
    if (tooBig) return json(res, 413, { error: 'payload_too_large' }, true);
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return json(res, 400, { error: 'bad_json' }, true); }
    onJson(data);
  });
  req.on('close', () => {
    if (handled || res.writableEnded) return;
    handled = true;
    if (tooBig && !res.headersSent) json(res, 413, { error: 'payload_too_large' }, true);
  });
  req.on('error', () => {
    if (!handled && !res.writableEnded) { handled = true; try { json(res, 400, { error: 'bad_json' }, true); } catch (e) {} }
  });
}

function handleApi(req, res, url, ip) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, DEV_CORS ? {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-TOR-Identity',
      'Access-Control-Max-Age': '600'
    } : {});
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', uptime: Math.floor(process.uptime()) }, true);
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const identity = getRequestIdentity(req, url);
    if (!ID_RE.test(identity)) return json(res, 400, { error: 'bad_identity' }, true);
    const mine = solves[identity] || {};
    const myVer = verified[identity] || {};
    const names = loadPlayerNames();
    const rec = names[identity];
    const rawName = typeof rec === 'string' ? rec : (rec && !rec.hide && rec.name) || '';
    const publicSet = admin.getPublicChallengeIds();
    const openSet = admin.getOpenChallengeIds();
    const pending = Object.keys(myVer).filter(id => !mine[id] && openSet.has(id));
    const solved = Object.keys(mine).filter(id => publicSet.has(id));
    const solveTimes = {};
    solved.forEach(id => { solveTimes[id] = mine[id]; });
    return json(res, 200, { solved, solveTimes, pending, name: rawName }, true);
  }

  if (url.pathname === '/api/solvers' && req.method === 'GET') {
    const challenge = url.searchParams.get('challenge');
    const names = loadPlayerNames();
    const publicSet = admin.getPublicChallengeIds();
    const pst = readJsonCached(PLAYERS_STATE_FILE, {});
    const hiddenIds = new Set(Array.isArray(pst.disabled) ? pst.disabled : []);   // disabled = removed from public lists
    if (challenge) {
      if (!publicSet.has(challenge)) return json(res, 404, { error: 'unknown_challenge' }, true);
      const list = [];
      Object.keys(solves).forEach(id => {
        if (hiddenIds.has(id)) return;
        if (solves[id] && solves[id][challenge]) {
          list.push({
            name: playerDisplayName(names[id]),
            ts: solves[id][challenge]
          });
        }
      });
      list.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      return json(res, 200, { challenge, solvers: list }, true);
    }
    const all = {};
    Object.keys(solves).forEach(id => {
      if (hiddenIds.has(id)) return;
      const pSolves = solves[id] || {};
      Object.keys(pSolves).forEach(chId => {
        if (!publicSet.has(chId)) return;
        if (!all[chId]) all[chId] = [];
        all[chId].push({
          name: playerDisplayName(names[id]),
          ts: pSolves[chId]
        });
      });
    });
    Object.keys(all).forEach(chId => {
      all[chId].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    });
    return json(res, 200, { solvers: all }, true);
  }

  if (url.pathname === '/api/solution' && req.method === 'GET') {
    const challenge = url.searchParams.get('challenge') || '';
    const identity = getRequestIdentity(req, url);
    if (!challenge || !admin.challengeIsPublic(challenge)) return json(res, 404, { error: 'unknown_challenge' }, true);
    if (!ID_RE.test(identity)) return json(res, 400, { error: 'bad_identity' }, true);
    if (isDisabled(identity)) return json(res, 403, { error: 'player_disabled' }, true);
    const cols = seo.loadCollections(DATA_DIR);
    const ch = (cols.challenges || []).find(c => c.id === challenge);
    if (!ch) return json(res, 404, { error: 'unknown_challenge' }, true);
    const solved = !!(solves[identity] && solves[identity][challenge]) || !!(verified[identity] && verified[identity][challenge]);
    if (!solved && ch.solution_public !== true && solutionsGated()) {
      return json(res, 403, { error: 'solve_required' }, true);
    }
    const rawSol = (ch.sections || []).filter(s => s && s.published !== false && s.zone === 'solution');
    const sol = admin.isArabicEnabled() ? rawSol : admin.stripArabicValue(rawSol);
    return json(res, 200, { challenge, sections: sol }, true);
  }

  if (url.pathname === '/api/claim' && req.method === 'POST') {
    if (!rateOk('ip:' + ip, RATE_PER_IP)) return json(res, 429, { error: 'rate_limited' }, true);
    readJsonBody(req, res, MAX_BODY, (data) => {
      if (!data || typeof data !== 'object') return json(res, 400, { error: 'bad_json' }, true);
      const identity = String(data.identity || '');
      const name = cleanName(data.name);
      const challenge = String(data.challenge || '');
      if (!ID_RE.test(identity)) return json(res, 400, { error: 'bad_identity' }, true);
      if (isDisabled(identity)) return json(res, 403, { error: 'player_disabled' }, true);
      if (!challenge || !admin.challengeIsOpen(challenge)) return json(res, 404, { error: 'unknown_challenge' }, true);
      if (!name) return json(res, 400, { error: 'name_required' }, true);
      if (!rateOk('claim:' + identity + ':' + challenge, RATE_PER_IP_CHALLENGE)) return json(res, 429, { error: 'rate_limited' }, true);
      solves[identity] = solves[identity] || {};
      if (solves[identity][challenge]) {
        const curName = playerDisplayName(loadPlayerNames()[identity]);
        return json(res, 200, { status: 'already', ts: solves[identity][challenge], name: curName }, true);
      }
      const verTs = verified[identity] && verified[identity][challenge];
      if (!verTs) return json(res, 403, { error: 'flag_not_verified' }, true);
      const ts = verTs;
      solves[identity][challenge] = ts;
      saveSolves();
      if (verified[identity]) { delete verified[identity][challenge]; saveVerified(); }
      savePlayerName(identity, name);
      const rec2 = {
        id: crypto.randomBytes(8).toString('hex'), ts,
        identity, name, challenge, result: 'correct',
        flag_masked: '(claimed)',
        ip_hash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
      };
      try { appendLogRotating(path.join(DATA_DIR, 'submissions.jsonl'), JSON.stringify(rec2) + '\n'); } catch (e) { console.error('submissions log failed:', e.message); }
      return json(res, 200, { status: 'correct', ts, name }, true);
    });
    return;
  }

  if (url.pathname === '/api/submit' && req.method === 'POST') {
    if (!rateOk('ip:' + ip, RATE_PER_IP)) return json(res, 429, { error: 'rate_limited' }, true);
    readJsonBody(req, res, MAX_BODY, (data) => {
      if (!data || typeof data !== 'object') return json(res, 400, { error: 'bad_json' }, true);
      const identity = String(data.identity || '');
      const name = typeof data.name === 'string' ? cleanName(data.name) : '';
      const hasName = name.length > 0;
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
      const logSub = (result, who) => {
        const rec2 = {
          id: crypto.randomBytes(8).toString('hex'), ts: new Date().toISOString(),
          identity, name: who || 'Pending name', challenge, result,
          flag_masked: flag.slice(0, 3) + '\u2026(' + flag.length + ')',
          ip_hash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
        };
        try { appendLogRotating(path.join(DATA_DIR, 'submissions.jsonl'), JSON.stringify(rec2) + '\n'); } catch (e) { console.error('submissions log failed:', e.message); }
      };
      solves[identity] = solves[identity] || {};
      if (solves[identity][challenge]) {
        const curName = playerDisplayName(loadPlayerNames()[identity]);
        if (hasName) savePlayerName(identity, name);
        logSub('already', hasName ? name : curName);
        return json(res, 200, { status: 'already', ts: solves[identity][challenge], name: hasName ? name : curName }, true);
      }
      const policy = flagsNow._policy || {};
      const cand = policy.case_sensitive === false ? flag.toLowerCase() : flag;
      if (verifyFlagRecord(rec, cand)) {
        const ts = new Date().toISOString();
        if (hasName) {
          solves[identity][challenge] = ts;
          saveSolves();
          if (verified[identity] && verified[identity][challenge]) { delete verified[identity][challenge]; saveVerified(); }
          savePlayerName(identity, name);
          logSub('correct', name);
          return json(res, 200, { status: 'correct', ts, name }, true);
        }
        verified[identity] = verified[identity] || {};
        verified[identity][challenge] = verified[identity][challenge] || ts;
        saveVerified();
        return json(res, 200, { status: 'verified', ts: verified[identity][challenge] }, true);
      }
      logSub('wrong', name || 'Anonymous');
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
  '.pcap': 'application/vnd.tcpdump.pcap', '.pdf': 'application/pdf'
};
const COMPRESSIBLE_EXTS = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);
const compressCache = new Map();
function getCompressed(cacheKey, buf, enc) {
  const k = enc + ':' + cacheKey;
  if (compressCache.has(k)) return compressCache.get(k);
  const out = enc === 'br' ? zlib.brotliCompressSync(buf) : zlib.gzipSync(buf);
  if (compressCache.size > 120) compressCache.delete(compressCache.keys().next().value);
  compressCache.set(k, out);
  return out;
}
function bodyEtag(buf) {
  return 'W/"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"';
}
function sendResponse(req, res, opts) {
  const { buf, contentType, cacheControl, etag, cacheKey, isText, status = 200 } = opts;
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl
  };
  if (isText && buf.length >= 256) headers['Vary'] = 'Accept-Encoding';
  if (etag) {
    headers['ETag'] = etag;
    const inm = req.headers['if-none-match'];
    if (inm && inm === etag && status === 200) {
      res.writeHead(304, headers);
      return res.end();
    }
  }
  let payload = buf;
  if (isText && buf.length >= 256) {
    const ae = String(req.headers['accept-encoding'] || '').toLowerCase();
    if (ae.includes('br')) {
      payload = getCompressed(cacheKey || etag || '', buf, 'br');
      headers['Content-Encoding'] = 'br';
    } else if (ae.includes('gzip')) {
      payload = getCompressed(cacheKey || etag || '', buf, 'gzip');
      headers['Content-Encoding'] = 'gzip';
    }
  }
  headers['Content-Length'] = payload.length;
  res.writeHead(status, headers);
  return res.end(req.method === 'HEAD' ? undefined : payload);
}

function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end('bad path'); }
  if (p === '/admin' || p === '/admin/') { res.writeHead(302, { Location: '/admin/index.html' }); return res.end(); }
  if (p === '/content.js') {
    const arabicEnabled = admin.isArabicEnabled();
    const buf = Buffer.from(admin.publicContentScript(), 'utf8');
    const etag = bodyEtag(buf);
    return sendResponse(req, res, {
      buf,
      contentType: 'text/javascript; charset=utf-8',
      cacheControl: 'public, max-age=0, must-revalidate',
      etag,
      cacheKey: 'content.js:ar=' + (arabicEnabled ? '1' : '0') + ':' + etag,
      isText: true
    });
  }
  const arabicEnabled = admin.isArabicEnabled();
  if (!arabicEnabled && /^\/[a-z0-9][a-z0-9-]*-ar\.html$/.test(p)) {
    const enTarget = p.replace(/-ar\.html$/, '-en.html');
    const enFile = path.resolve(ROOT, '.' + enTarget);
    if (!enFile.startsWith(ROOT + path.sep) || !fs.existsSync(enFile)) {
      return sendResponse(req, res, {
        buf: Buffer.from(seo.render404(ROOT, false), 'utf8'),
        status: 404,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-store',
        isText: true
      });
    }
    const dm = /^\/(article|challenge|investigation)-ar\.html$/.exec(p);
    if (dm) {
      const idParam = url.searchParams.get('id') || url.searchParams.get('c') || url.searchParams.get('a') || '';
      if (idParam) {
        const pubCols = publicCollections(seo.loadCollections(DATA_DIR));
        const item = (pubCols[dm[1] + 's'] || []).find(x => x.id === idParam || (x.slug && (x.slug.ar === idParam || x.slug.en === idParam)));
        if (!item || (!(item.title && item.title.en) && !(item.slug && item.slug.en))) {
          return sendResponse(req, res, {
            buf: Buffer.from(seo.render404(ROOT, false), 'utf8'),
            status: 404,
            contentType: 'text/html; charset=utf-8',
            cacheControl: 'no-store',
            isText: true
          });
        }
        const keyName = url.searchParams.get('id') ? 'id' : (url.searchParams.get('c') ? 'c' : 'a');
        const enId = (item.slug && item.slug.en) || item.id;
        res.writeHead(302, { Location: '/' + dm[1] + '-en.html?' + keyName + '=' + encodeURIComponent(enId), 'Cache-Control': 'no-store' });
        return res.end();
      }
    }
    res.writeHead(302, { Location: enTarget + (url.search || ''), 'Cache-Control': 'no-store' });
    return res.end();
  }
  // Explicit static surface: no server files, backups, dotfiles or test fixtures.
  const allowed = /^\/(?!admin\.html$)[a-z0-9][a-z0-9-]*\.html$/.test(p) || ['/', '/script.js', '/style.css'].includes(p) || /^\/admin\/[a-z][a-z0-9-]*\.(html|js|css)$/.test(p) || /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpg|jpeg|png|gif|webp|svg|woff2?|pdf)$/.test(p);
  if (!allowed) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return sendResponse(req, res, {
        buf: Buffer.from(seo.render404(ROOT, arabicEnabled), 'utf8'),
        status: 404,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-store',
        isText: true
      });
    }
    res.writeHead(404); return res.end('not found');
  }
  // admin HTML pages (except login) require a session; assets stay public
  if (/^\/admin\/(?!login\.html$|recovery\.html$).+\.html$/.test(p)) {
    if (!admin.getSession(req)) {
      res.writeHead(302, { Location: '/admin/login.html' });
      return res.end();
    }
  }
  if(p==='/admin/preview.html'){
    const k=url.searchParams.get('kind');const kind=(k==='article'||k==='investigation')?k:'challenge';
    if(!arabicEnabled && url.searchParams.get('lang')==='ar'){
      const idq=url.searchParams.get('id')||'';
      res.writeHead(302,{Location:'/admin/preview.html?kind='+kind+'&lang=en'+(idq?'&id='+encodeURIComponent(idq):''),'Cache-Control':'no-store'});return res.end();
    }
    const lang=(arabicEnabled && url.searchParams.get('lang')!=='en')?'ar':'en';
    let html=fs.readFileSync(path.join(ROOT,kind+'-'+lang+'.html'),'utf8').replace('<head>','<head><base href="/">').replace('<script src="content.js"></script>','<script src="/admin/api/preview-content"></script>');
    html=html.replace('<body','<body data-admin-preview="true"');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);
  }
  if (p === '/' || p === '/index.html') {
    if (!arabicEnabled) {
      p = '/index-en.html';
    } else {
      const cfg = readJsonCached(SITE_SETTINGS_FILE, {});
      p = cfg.default_language === 'ar' ? '/index-ar.html' : '/index-en.html';
    }
  }
  if (!arabicEnabled && p === '/404.html') {
    p = '/404-en.html';
  }
  let file;
  let isCustomMedia = false;
  if (p.startsWith('/assets/')) {
    const assetName = p.slice('/assets/'.length);
    const customAsset = path.resolve(MEDIA_DIR, assetName);
    if (customAsset.startsWith(MEDIA_DIR + path.sep) && fs.existsSync(customAsset)) {
      file = customAsset;
      isCustomMedia = true;
    } else {
      file = path.resolve(ROOT, '.' + p);
    }
  } else {
    file = path.resolve(ROOT, '.' + p);
  }
  if (isCustomMedia) {
    if (!file.startsWith(MEDIA_DIR + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  } else {
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
    if (file.startsWith(path.join(ROOT, 'server') + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return sendResponse(req, res, {
          buf: Buffer.from(seo.render404(ROOT, arabicEnabled), 'utf8'),
          status: 404,
          contentType: 'text/html; charset=utf-8',
          cacheControl: 'no-store',
          isText: true
        });
      }
      res.writeHead(404); return res.end('not found');
    }
    const ext = path.extname(file).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    const isAdminRoute = p.startsWith('/admin/');
    const isAsset = p.startsWith('/assets/');
    const isText = COMPRESSIBLE_EXTS.has(ext);
    const statEtag = 'W/"' + st.size + '-' + Math.floor(st.mtimeMs) + '"';

    if (ext === '.html') {
      const rawHtml = fs.readFileSync(file, 'utf8');
      const resMeta = /^\/(article|challenge|investigation)-(ar|en)\.html$/.test(p)
        ? seo.injectDetailMeta(rawHtml, p, url, ROOT, DATA_DIR, arabicEnabled)
        : { status: 200, html: seo.injectStaticMeta(rawHtml, DATA_DIR, arabicEnabled, p) };
      const buf = Buffer.from(resMeta.html, 'utf8');
      const etag = (isAdminRoute || resMeta.status !== 200) ? null : bodyEtag(Buffer.concat([buf, Buffer.from(':ar=' + (arabicEnabled ? '1' : '0'))]));
      return sendResponse(req, res, {
        buf,
        status: resMeta.status,
        contentType: 'text/html; charset=utf-8',
        cacheControl: (isAdminRoute || resMeta.status !== 200) ? 'no-store' : 'public, max-age=0, must-revalidate',
        etag,
        cacheKey: p + ':ar=' + (arabicEnabled ? '1' : '0') + ':' + (etag || 'ns'),
        isText: true
      });
    }

    const cc = isAdminRoute ? 'no-store' : (isAsset ? 'public, max-age=2592000' : 'public, max-age=0, must-revalidate');
    const etag = isAdminRoute ? null : statEtag;
    if (etag && req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'Cache-Control': cc,
        'ETag': etag,
        ...(isText && st.size >= 256 ? { 'Vary': 'Accept-Encoding' } : {})
      });
      return res.end();
    }
    if (isText) {
      const buf = fs.readFileSync(file);
      return sendResponse(req, res, {
        buf,
        contentType: ct,
        cacheControl: cc,
        etag,
        cacheKey: p + ':' + st.size + '-' + Math.floor(st.mtimeMs),
        isText: true
      });
    }
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Length': st.size,
      'Cache-Control': cc,
      ...(etag ? { 'ETag': etag } : {})
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function handleRequest(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const isAdminReq = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
  const scriptSrc = isAdminReq ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'";
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  );
  if (HTTPS_MODE) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const ip = clientIp(req);
  if(url.pathname==='/sitemap.xml'){
    const xml = seo.renderSitemap(DATA_DIR, admin.isArabicEnabled());
    if (!xml) { res.writeHead(404,{'Content-Type':'text/plain'}); return res.end('Configure a real HTTPS site origin in admin settings first.'); }
    res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8'}); return res.end(xml);
  }
  if (url.pathname === '/feed.xml' || url.pathname === '/feed-ar.xml') {
    const arOn = admin.isArabicEnabled();
    if (url.pathname === '/feed-ar.xml' && !arOn) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const xml = seo.renderFeed(url.pathname === '/feed-ar.xml' ? 'ar' : 'en', DATA_DIR, arOn);
    if (!xml) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Configure a real HTTPS site origin in admin settings first.'); }
    res.writeHead(200, { 'Content-Type': 'application/atom+xml; charset=utf-8' }); return res.end(xml);
  }
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(seo.renderRobots(DATA_DIR));
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
}

const server = http.createServer((req, res) => {
  try { handleRequest(req, res); } catch (e) {
    console.error('request error:', e && e.message);
    try { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('internal error'); } catch (e2) {}
  }
});
process.on('uncaughtException', e => console.error('uncaughtException:', e && e.stack || e));
process.on('unhandledRejection', e => console.error('unhandledRejection:', e && e.stack || e));

server.listen(PORT, HOST, () => {
  console.log(`Temple of Records demo server: http://${HOST}:${PORT}`);
  console.log('Static site + flag API. Local demo only — not production hosting.');
});
