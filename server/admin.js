// Admin backend module: auth (scrypt, sessions, CSRF), audit log, content store,
// challenge CRUD, flag configuration, submissions, players, stats.
// Local demo grade — not production hardened. No public admin signup.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const { readJsonCached, writeJsonAtomic, appendLogRotating } = require('./json-cache');
const TorAdmin = require('./validators');
const { isPlaceholder } = require('./placeholders');
const { isPublic, isPublicInvestigation, publicCollections } = require('./visibility');

const DATA = process.env.TOR_DATA_DIR ? path.resolve(process.env.TOR_DATA_DIR) : path.join(__dirname, 'data');
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = DATA;
const ADMIN_FILE = path.join(DATA, 'admin.json');
const SESSIONS_FILE = path.join(DATA, 'sessions.json');
const STORE_FILE = path.join(DATA, 'store.json');
const SITE_SETTINGS_FILE = path.join(DATA, 'site-settings.json');
const SOLVES_FILE = path.join(DATA, 'solves.json');
const PLAYERS_STATE_FILE = path.join(DATA_DIR, 'players_state.json');
const PLAYER_NAMES_FILE = path.join(DATA_DIR, 'players_names.json');
const SEO_FILE = path.join(DATA_DIR, 'seo.json');
const AUDIT_FILE = path.join(DATA, 'audit.jsonl');
const SUBMISSIONS_FILE = path.join(DATA, 'submissions.jsonl');
const FLAGS_FILE = process.env.TOR_FLAGS_FILE ? path.resolve(process.env.TOR_FLAGS_FILE) : path.join(__dirname, 'flags.json');
const MEDIA_DIR = path.join(DATA_DIR, 'assets');
const BUILTIN_MEDIA_DIR = path.join(ROOT, 'assets');

fs.mkdirSync(DATA_DIR, { recursive: true });
const SESSION_TTL_MS = 12 * 3600 * 1000;
const DUMMY_SCRYPT_SALT = 'tor-dummy-salt-0000';

// Session cookie flags. TOR_HTTPS=1 (site served over HTTPS) adds Secure.
const COOKIE_FLAGS = 'HttpOnly; SameSite=Strict' + (process.env.TOR_HTTPS === '1' ? '; Secure' : '') + '; Path=/admin';

// Magic bytes for allowed raster image uploads (SVG blocked: active same-origin content).
const MAGIC = [
  { ext: ['jpg', 'jpeg'], test: b => b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF && b.indexOf(Buffer.from([0xFF, 0xD9]), Math.max(0, b.length - 1024)) !== -1 },
  { ext: ['png'], test: b => b.length > 33 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b.toString('ascii', 12, 16) === 'IHDR' && b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0 && b.readUInt32BE(16) <= 20000 && b.readUInt32BE(20) <= 20000 && b.indexOf('IEND', b.length - 16) !== -1 },
  { ext: ['gif'], test: b => b.length > 6 && b.toString('ascii', 0, 6).match(/^GIF8[79]a/) !== null && b.lastIndexOf(0x3B) >= b.length - 16 },
  { ext: ['webp'], test: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' && Math.abs(b.readUInt32LE(4) + 8 - b.length) <= 1 }
];

const SCHEMAS = {
  tags: {
    fields: [
      { k: 'name', t: 'bi', max: 120, required: true },
      { k: 'slug', t: 'bi', max: 120 },
      { k: 'description', t: 'bi', max: 1000 }
    ]
  },
  categories: {
    fields: [
      { k: 'name', t: 'bi', max: 120, required: true },
      { k: 'description', t: 'bi', max: 1000 },
      { k: 'slug', t: 'bi', max: 120 },
      { k: 'kind', t: 'enum', values: ['challenge', 'article', 'investigation'] }
    ]
  },
  investigations: {
    fields: [
      // --- overview ---
      { k: 'title', t: 'bi', max: 300, required: true },
      { k: 'slug', t: 'slug', max: 120 },
      { k: 'summary', t: 'bi', max: 6000 },
      { k: 'status', t: 'enum', values: ['open', 'closed', 'draft'] },
      { k: 'visibility', t: 'enum', values: ['private', 'public'] },
      { k: 'date', t: 'str', max: 40 },
      { k: 'publish_at', t: 'str', max: 40 },
      { k: 'tags', t: 'tags' },
      { k: 'attack', t: 'tags' },
      { k: 'use_case', t: 'bi', max: 12000 },
      // --- lab environment ---
      { k: 'lab_environment', t: 'bi', max: 12000 },
      { k: 'lab_components', t: 'rows', max: 30, cols: [
        { k: 'host', t: 'str', max: 120 }, { k: 'role', t: 'str', max: 160 },
        { k: 'os_tools', t: 'str', max: 300 }, { k: 'notes', t: 'str', max: 600 }] },
      // --- evidence register ---
      { k: 'evidence_register', t: 'rows', max: 200, cols: [
        { k: 'ref', t: 'str', max: 40 }, { k: 'name', t: 'str', max: 200 },
        { k: 'type', t: 'enum', values: ['disk', 'memory', 'pcap', 'log', 'file', 'screenshot', 'other'] },
        { k: 'source', t: 'str', max: 300 }, { k: 'sha256', t: 'sha256' },
        { k: 'acquired_at', t: 'str', max: 60 }, { k: 'notes', t: 'text', max: 1000 }, { k: 'url', t: 'url' }] },
      { k: 'evidence', t: 'links', max: 50 },
      // --- timeline / analysis / findings ---
      { k: 'timeline', t: 'entries', max: 200 },
      { k: 'analysis', t: 'bi', max: 20000 },
      { k: 'findings', t: 'bi', max: 20000 },
      { k: 'findings_list', t: 'rows', max: 50, cols: [
        { k: 'title', t: 'str', max: 200 },
        { k: 'severity', t: 'enum', values: ['info', 'low', 'medium', 'high', 'critical'] },
        { k: 'description', t: 'text', max: 3000 }, { k: 'evidence_ref', t: 'str', max: 200 }] },
      { k: 'root_cause', t: 'bi', max: 8000 },
      // --- MITRE ATT&CK mapping ---
      { k: 'mitre_mapping', t: 'rows', max: 100, cols: [
        { k: 'technique', t: 'attack' },
        { k: 'tactic', t: 'enum', values: ['', 'reconnaissance', 'resource-development', 'initial-access', 'execution', 'persistence',
          'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection',
          'command-and-control', 'exfiltration', 'impact'] },
        { k: 'observation', t: 'text', max: 1500 }, { k: 'detection_ref', t: 'str', max: 60 }] },
      // --- detection engineering ---
      { k: 'detection_engineering', t: 'bi', max: 20000 },
      { k: 'detections', t: 'rows', max: 20, cols: [
        { k: 'rule_id', t: 'str', max: 60 }, { k: 'title', t: 'str', max: 200 },
        { k: 'status', t: 'enum', values: ['draft', 'tested', 'production'] },
        { k: 'severity', t: 'enum', values: ['low', 'medium', 'high', 'critical'] },
        { k: 'use_case', t: 'text', max: 4000 }, { k: 'data_sources', t: 'str', max: 400 },
        { k: 'sigma', t: 'code', max: 12000 }, { k: 'spl', t: 'code', max: 12000 }, { k: 'kql', t: 'code', max: 12000 },
        { k: 'other_lang', t: 'str', max: 40 }, { k: 'other_rule', t: 'code', max: 12000 },
        { k: 'false_positives', t: 'text', max: 4000 }, { k: 'tuning', t: 'text', max: 4000 },
        { k: 'validation', t: 'text', max: 4000 }, { k: 'attack', t: 'attacklist' }] },
      { k: 'detection_rule_lang', t: 'str', max: 60 },   // legacy single rule (migrated into `detections` by the editor)
      { k: 'detection_rule', t: 'code', max: 30000 },    // legacy single rule
      // --- closing ---
      { k: 'lessons_learned', t: 'bi', max: 10000 },
      { k: 'links', t: 'links', max: 50 },
      { k: 'seo_title', t: 'bi', max: 200 },
      { k: 'meta_description', t: 'bi', max: 500 },
      { k: 'image', t: 'img' }
    ]
  }
};

// ---- persistence + stat-invalidated caching ----
function readJson(f, dflt) { return readJsonCached(f, dflt); }
function readJsonMutable(f, dflt) { return structuredClone(readJsonCached(f, dflt)); }
function writeJson(f, obj) { writeJsonAtomic(f, obj); }
function appendLine(f, obj) { appendLogRotating(f, JSON.stringify(obj) + '\n'); }

const jsonLinesCache = new Map();
function readJsonLinesCached(f) {
  let st;
  try { st = fs.statSync(f); } catch (e) { jsonLinesCache.delete(f); return []; }
  const sig = `${st.mtimeMs}:${st.ctimeMs}:${st.size}`;
  const hit = jsonLinesCache.get(f);
  if (hit && hit.sig === sig) return hit.rows;
  let rows = [];
  try {
    rows = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (e) {
    rows = [];
  }
  jsonLinesCache.set(f, { sig, rows });
  return rows;
}

function statSig(filePath) {
  try {
    const st = fs.statSync(filePath);
    return `${st.mtimeMs}:${st.ctimeMs}:${st.size}`;
  } catch (e) {
    return 'missing';
  }
}

function audit(actor, action, entity, result, detail) {
  appendLine(AUDIT_FILE, { ts: new Date().toISOString(), actor, action, entity, result, detail: detail || '' });
}

// ---- security helpers & admin account ----
function safeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a == null ? '' : a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b == null ? '' : b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function scryptHash(pass, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pass, salt, 32).toString('hex');
  return 'scrypt:' + salt + ':' + h;
}

function scryptVerify(pass, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3) return false;
  const h = crypto.scryptSync(pass, parts[1], 32);
  const ref = Buffer.from(parts[2], 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(ref, h);
}

function adminExists() { return !!readJson(ADMIN_FILE, null); }

function initAdminFromEnv() {
  const envUser = process.env.ADMIN_USER || process.env.TOR_ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || process.env.TOR_ADMIN_PASS;
  if (envUser && envPass && !adminExists()) {
    if (envUser.length >= 3 && envPass.length >= 10) {
      writeJson(ADMIN_FILE, { username: envUser, pass: scryptHash(envPass), created: new Date().toISOString() });
      audit(envUser, 'admin_setup_env', 'admin', 'ok');
      console.log('Admin account created from environment variables for:', envUser);
    }
  }
}
initAdminFromEnv();

// ---- sessions (tokens hashed at rest; expired sessions pruned on login/expiry) ----
let sessions = readJsonMutable(SESSIONS_FILE, {});
function hashSessionId(id) {
  return crypto.createHash('sha256').update(String(id), 'utf8').digest('hex');
}
function saveSessions() { writeJson(SESSIONS_FILE, sessions); }
function pruneExpiredSessions(map, now = Date.now()) {
  let changed = false;
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v.exp !== 'number' || v.exp <= now) {
      delete map[k];
      changed = true;
    }
  }
  return changed;
}
if (pruneExpiredSessions(sessions)) saveSessions();

function createSession(username) {
  pruneExpiredSessions(sessions);
  const id = crypto.randomBytes(24).toString('hex');
  const key = hashSessionId(id);
  sessions[key] = { username, csrf: crypto.randomBytes(24).toString('hex'), exp: Date.now() + SESSION_TTL_MS };
  saveSessions();
  return { id, key, csrf: sessions[key].csrf, exp: sessions[key].exp };
}

function getSession(req) {
  const m = /(?:^|;\s*)tor_admin=([a-f0-9]{48})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const key = hashSessionId(m[1]);
  const s = sessions[key];
  if (!s) return null;
  if (s.exp <= Date.now()) {
    pruneExpiredSessions(sessions);
    saveSessions();
    return null;
  }
  return { id: m[1], key, ...s };
}

// ---- content store (seed once from content.js; store.json is the single runtime source) ----
let cachedSeedStoreRaw = null;
function seedStoreRaw() {
  if (!cachedSeedStoreRaw) {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(
      fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8') + '\nthis.f = SITE_CONTENT; this.c = SITE_COLLECTIONS;',
      ctx
    );
    cachedSeedStoreRaw = { fixed: ctx.f, collections: ctx.c };
  }
  return cachedSeedStoreRaw;
}
function seedStore() {
  const raw = seedStoreRaw();
  return structuredClone({ fixedDefaults: raw.fixed.defaults, collections: raw.collections });
}
function seedFields() { return seedStoreRaw().fixed.fields; }

function getStore() {
  let st = readJson(STORE_FILE, null);
  if (!st) {
    st = seedStore();
    writeJson(STORE_FILE, st);
  }
  return st;
}
function getStoreMutable() { return structuredClone(getStore()); }
function publishStore(st) { writeJson(STORE_FILE, st); }

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const TOO_LARGE_REQS = new WeakSet();
function readBody(req, cap) {
  const limit = cap || 65536;
  return new Promise((resolve) => {
    const chunks = [];
    let bytes = 0, done = false, tooBig = false;
    const finish = val => { if (!done) { done = true; resolve(val); } };
    req.on('data', c => {
      bytes += c.length;
      if (bytes > limit) {
        tooBig = true;
        TOO_LARGE_REQS.add(req);
        chunks.length = 0;
        if (bytes > Math.max(limit * 4, 2 * 1024 * 1024)) req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return finish(null);
      try { finish(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { finish(null); }
    });
    req.on('close', () => finish(null));
    req.on('error', () => finish(null));
  });
}

const loginHits = new Map();
function loginRateOk(ip) {
  const now = Date.now();
  const arr = (loginHits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 5) { loginHits.set(ip, arr); return false; }
  arr.push(now); loginHits.set(ip, arr);
  if (loginHits.size > 2000) {
    for (const [k, v] of loginHits) if (!v.length || now - v[v.length - 1] >= 60000) loginHits.delete(k);
  }
  return true;
}

// ---- shared helpers for validation, media, flags, and CRUD ----
function sniffImage(buf, ext) {
  const m = MAGIC.find(item => item.ext.includes(ext));
  return !!m && m.test(buf);
}

function assetRefs(name) {
  const refs = [];
  const needle = 'assets/' + name;
  ['content.js', 'script.js', 'style.css'].forEach(f => {
    try { if (fs.readFileSync(path.join(ROOT, f), 'utf8').includes(needle)) refs.push(f); } catch (e) {}
  });
  try {
    fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => {
      if (fs.readFileSync(path.join(ROOT, f), 'utf8').includes(needle)) refs.push(f);
    });
  } catch (e) {}
  try {
    if (fs.existsSync(STORE_FILE) && fs.readFileSync(STORE_FILE, 'utf8').includes(needle)) refs.push('store.json');
  } catch (e) {}
  try {
    if (fs.existsSync(SITE_SETTINGS_FILE) && fs.readFileSync(SITE_SETTINGS_FILE, 'utf8').includes(needle)) refs.push('site-settings.json');
  } catch (e) {}
  return refs;
}

function formatFlagMeta(rec) {
  if (!rec) return { configured: false, algo: null, sha256: null, hash: null };
  const algo = rec.scrypt ? 'scrypt' : 'sha256';
  const display = rec.scrypt ? ('scrypt:' + rec.scrypt) : (rec.sha256 || null);
  return { configured: true, algo, sha256: display, hash: rec.scrypt || rec.sha256 || null };
}

const ATTACK_ID_RE = /^T\d{4}(\.\d{3})?$/;
function cleanBySchema(schema, b, existing, opts) {
  const arEnabled = !(opts && opts.arabicEnabled === false);
  const fail = (msg) => { if (opts && Array.isArray(opts.errors)) opts.errors.push(msg); return null; };
  const t = (x, n) => TorAdmin.cleanStr(String(x == null ? '' : x).slice(0, n || 1000), n || 1000) || '';
  const bi = (o, m) => ({ ar: t(o && o.ar, m), en: t(o && o.en, m) });
  const item = { id: existing || t(b.id, 60), hidden: !!b.hidden };
  for (const f of schema.fields) {
    const v = b[f.k];
    if (f.t === 'bi') item[f.k] = bi(v, f.max);
    else if (f.t === 'slug') {
      const s = bi(v, f.max);
      if ((s.ar && !/^[\p{L}\p{N}-]+$/u.test(s.ar)) || (s.en && !/^[\p{L}\p{N}-]+$/u.test(s.en))) return null;
      item[f.k] = s;
    } else if (f.t === 'img') {
      const im = t(v, 500).trim();
      if (im && !TorAdmin.imgOk(im)) return null;
      if (im) item[f.k] = im;
    } else if (f.k === 'publish_at') {
      const pa = t(v, 60).trim();
      if (pa) {
        const d = new Date(pa);
        if (isNaN(d.getTime())) return null;
        item[f.k] = d.toISOString();
      } else {
        item[f.k] = '';
      }
    } else if (f.t === 'str' || f.t === 'code') item[f.k] = t(v, f.max);
    else if (f.t === 'enum') item[f.k] = f.values.includes(v) ? v : f.values[0];
    else if (f.t === 'tags') {
      const arr = Array.isArray(v) ? v.map(x => t(x, 40).trim()).filter(Boolean).slice(0, 20) : [];
      item[f.k] = f.k === 'attack' ? arr.map(x => x.toUpperCase()).filter(x => /^T\d{4}(\.\d{3})?$/.test(x)) : arr;
    } else if (f.t === 'url') {
      const u = t(v, 500).trim();
      if (u && !TorAdmin.urlOk(u)) return null;
      item[f.k] = u;
    } else if (f.t === 'entries') {
      item[f.k] = Array.isArray(v) ? v.slice(0, f.max).map(e => ({ ts: t(e && e.ts, 40), ar: t(e && e.ar, 2000), en: t(e && e.en, 2000) })) : [];
    } else if (f.t === 'links') {
      const ls = Array.isArray(v) ? v.slice(0, f.max).map(e => ({ label: t(e && e.label, 120), url: t(e && e.url, 500).trim() })) : [];
      if (ls.some(l => l.url && !TorAdmin.urlOk(l.url))) return fail(f.k + ': link must be https://…');
      item[f.k] = ls;
    } else if (f.t === 'rows') {
      const out = [];
      const src = Array.isArray(v) ? v.slice(0, f.max || 50) : [];
      for (let ri = 0; ri < src.length; ri++) {
        const r = src[ri] || {};
        const row = {};
        for (const c of f.cols) {
          const cv = r[c.k];
          const where = f.k + ' #' + (ri + 1) + ' ' + c.k;
          if (c.t === 'enum') row[c.k] = c.values.includes(cv) ? cv : c.values[0];
          else if (c.t === 'url') {
            const u = t(cv, 500).trim();
            if (u && !TorAdmin.urlOk(u)) return fail(where + ': link must be https://…');
            row[c.k] = u;
          } else if (c.t === 'sha256') {
            const h = t(cv, 140).trim().toLowerCase().replace(/^sha-?256\s*[:=]?\s*/, '');
            if (h && !/^[a-f0-9]{64}$/.test(h)) return fail(where + ': SHA-256 must be 64 hex characters');
            row[c.k] = h;
          } else if (c.t === 'attack') {
            const id = t(cv, 20).trim().toUpperCase();
            if (id && !ATTACK_ID_RE.test(id)) return fail(where + ': technique must look like T1059 or T1059.001');
            row[c.k] = id;
          } else if (c.t === 'attacklist') {
            const ids = t(cv, 200).split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
            const badId = ids.find(x => !ATTACK_ID_RE.test(x));
            if (badId) return fail(where + ': "' + badId + '" is not a technique ID like T1059.001');
            row[c.k] = ids.join(', ');
          } else row[c.k] = t(cv, c.max || 500);     // str / text / code
        }
        // a row made only of defaults/blank cells is dropped
        if (f.cols.some(c => c.t !== 'enum' && String(row[c.k] || '').trim())) out.push(row);
      }
      item[f.k] = out;
    }
    if (f.required && f.t === 'bi') {
      if (!arEnabled && !item[f.k].en.trim()) return null;
      if (arEnabled && !item[f.k].ar.trim() && !item[f.k].en.trim()) return null;
    }
  }
  return item;
}

function checkSlugConflict(list, entry, excludeId, arabicOn) {
  const langs = arabicOn ? ['ar', 'en'] : ['en'];
  return list.some(item => {
    if (excludeId && item.id === excludeId) return false;
    if (!excludeId && item.id === entry.id) return true;
    return langs.some(l => entry.slug && entry.slug[l] && (item.id === entry.slug[l] || (item.slug && item.slug[l] === entry.slug[l])));
  });
}

async function handleEntryCrud(req, res, sess, id, kind) {
  const singular = kind === 'challenges' ? 'challenge' : 'article';
  const auditPrefix = singular + '_';

  if (req.method === 'POST' && !id) {
    const body = await readBody(req, 2 * 1024 * 1024);
    if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
    const arOn = isArabicEnabled();
    const vInput = kind === 'challenges' ? { articles: [], challenges: [body] } : { articles: [body], challenges: [] };
    const v = TorAdmin.validateCollections(vInput, { arabicEnabled: arOn });
    if (!v.ok) return json(res, 400, { error: 'invalid', details: v.errors.slice(0, 5) });
    const entry = v.value[kind][0];
    entry.updated_at = new Date().toISOString();
    // Read store synchronously after awaiting request body to prevent lost updates on concurrent saves.
    const st = getStoreMutable();
    const list = st.collections[kind];
    if (checkSlugConflict(list, entry, null, arOn)) return json(res, 409, { error: 'duplicate_id' });
    list.push(entry);
    publishStore(st);
    audit(sess.username, auditPrefix + 'create', entry.id, 'ok');
    return json(res, 200, { status: 'created', id: entry.id });
  }

  if (req.method === 'PUT' && id) {
    const body = await readBody(req, 2 * 1024 * 1024);
    if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
    if (!body) return json(res, 400, { error: 'invalid_json' });
    const st = getStoreMutable();
    const list = st.collections[kind];
    const entry = list.find(x => x.id === id);
    if (!entry) return json(res, 404, { error: 'not_found' });
    body.id = id; // id immutable via this route
    const arOn = isArabicEnabled();
    const payload = arOn ? body : mergeArabic(body, entry);
    const vInput = kind === 'challenges' ? { articles: [], challenges: [payload] } : { articles: [payload], challenges: [] };
    const v = TorAdmin.validateCollections(vInput, { arabicEnabled: arOn });
    if (!v.ok) return json(res, 400, { error: 'invalid', details: v.errors.slice(0, 5) });
    const next = v.value[kind][0];
    if (checkSlugConflict(list, next, entry.id, arOn)) return json(res, 409, { error: 'duplicate_slug' });
    next.updated_at = new Date().toISOString();
    list[list.indexOf(entry)] = next;
    publishStore(st);
    audit(sess.username, auditPrefix + 'update', entry.id, 'ok');
    return json(res, 200, { status: 'updated', id: entry.id });
  }

  const st = getStoreMutable();
  const list = st.collections[kind];
  const entry = list.find(x => x.id === id);
  if (!entry) return json(res, 404, { error: 'not_found' });

  if (req.method === 'DELETE') {
    if (kind === 'challenges') {
      list.splice(list.indexOf(entry), 1);
      publishStore(st);
      const flags = readJsonMutable(FLAGS_FILE, {});
      delete flags[entry.id];
      writeJson(FLAGS_FILE, flags);
      audit(sess.username, 'challenge_delete', entry.id, 'ok', 'flag also removed');
      return json(res, 200, { status: 'deleted', id: entry.id });
    }
    entry.hidden = true;
    entry.status = 'archived';
    publishStore(st);
    audit(sess.username, 'article_archive', entry.id, 'ok');
    return json(res, 200, { status: 'archived', id: entry.id });
  }

  if (req.method === 'GET') return json(res, 200, { [singular]: entry });
  return json(res, 404, { error: 'not_found' });
}

async function handle(req, res, url, ip) {
  const p = url.pathname;

  // --- auth endpoints ---
  if (p === '/admin/api/setup' && req.method === 'POST') {
    const rawIp = req.socket.remoteAddress;
    const viaProxy = ['x-forwarded-for', 'x-real-ip', 'x-forwarded-host', 'forwarded'].some(h => req.headers[h]);
    const body = await readBody(req);
    const setupToken = process.env.SETUP_TOKEN || process.env.TOR_SETUP_TOKEN;
    const headerTok = typeof req.headers['x-setup-token'] === 'string' ? req.headers['x-setup-token'] : '';
    const bodyTok = body && typeof body.setup_token === 'string' ? body.setup_token : '';
    const hasValidToken = !!(setupToken && ((headerTok && safeEqualStr(headerTok, setupToken)) || (bodyTok && safeEqualStr(bodyTok, setupToken))));
    if (!hasValidToken) {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(rawIp) || viaProxy) return json(res, 403, { error: 'localhost_only' });
    }
    if (adminExists()) return json(res, 409, { error: 'already_configured' });
    if (!body || typeof body.username !== 'string' || !/^[A-Za-z0-9_.-]{3,40}$/.test(body.username) || typeof body.password !== 'string' || body.password.length < 10) {
      return json(res, 400, { error: 'weak_credentials', detail: 'username 3-40 chars, password 10+ chars' });
    }
    writeJson(ADMIN_FILE, { username: body.username, pass: scryptHash(body.password), created: new Date().toISOString() });
    audit(body.username, 'admin_setup', 'admin', 'ok');
    return json(res, 200, { status: 'configured' });
  }

  if (p === '/admin/api/login' && req.method === 'POST') {
    if (!loginRateOk(ip)) return json(res, 429, { error: 'rate_limited' });
    const body = await readBody(req);
    const admin = readJson(ADMIN_FILE, null);
    const candidatePass = String((body && body.password) || '');
    const userMatch = !!(admin && body && typeof body.username === 'string' && safeEqualStr(body.username, admin.username));
    let passMatch = false;
    if (userMatch) {
      passMatch = scryptVerify(candidatePass, admin.pass);
    } else {
      // Equalize scrypt latency so wrong usernames do not fast-path.
      crypto.scryptSync(candidatePass, DUMMY_SCRYPT_SALT, 32);
    }
    const ok = userMatch && passMatch;
    audit(body && body.username || '?', 'login', 'admin', ok ? 'ok' : 'failed');
    if (!ok) return json(res, 401, { error: 'invalid_credentials' });
    const s = createSession(admin.username);
    res.setHeader('Set-Cookie', `tor_admin=${s.id}; ${COOKIE_FLAGS}; Max-Age=${SESSION_TTL_MS / 1000}`);
    return json(res, 200, { status: 'ok', username: admin.username, csrf: s.csrf, expiresAt: new Date(s.exp).toISOString() });
  }

  // --- everything below requires a session ---
  const sess = getSession(req);
  if (!sess) return json(res, 401, { error: 'not_authenticated' });

  const csrfHeader = typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : '';
  if (p === '/admin/api/logout' && req.method === 'POST') {
    if (!csrfHeader || !safeEqualStr(csrfHeader, sess.csrf)) return json(res, 403, { error: 'bad_csrf' });
    delete sessions[sess.key];
    saveSessions();
    res.setHeader('Set-Cookie', 'tor_admin=; ' + COOKIE_FLAGS + '; Max-Age=0');
    audit(sess.username, 'logout', 'admin', 'ok');
    return json(res, 200, { status: 'ok' });
  }

  if (p === '/admin/api/me' && req.method === 'GET') {
    return json(res, 200, { username: sess.username, csrf: sess.csrf, expiresAt: new Date(sess.exp).toISOString(), arabic_enabled: isArabicEnabled() });
  }

  // CSRF on all mutating routes
  if (req.method !== 'GET' && (!csrfHeader || !safeEqualStr(csrfHeader, sess.csrf))) {
    return json(res, 403, { error: 'bad_csrf' });
  }

  if (p === '/admin/api/site-settings' && req.method === 'GET') {
    const s = readJson(SITE_SETTINGS_FILE, {});
    return json(res, 200, { settings: Object.assign({ arabic_enabled: false }, s) });
  }

  if (p === '/admin/api/site-settings' && req.method === 'PUT') {
    const b = await readBody(req);
    if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
    if (!b || typeof b !== 'object') return json(res, 400, { error: 'invalid' });
    if (b.arabic_enabled !== undefined && typeof b.arabic_enabled !== 'boolean') return json(res, 400, { error: 'invalid_arabic_enabled' });
    const old = readJson(SITE_SETTINGS_FILE, {});
    const out = {};
    for (const k of ['name_ar', 'name_en', 'description_ar', 'description_en', 'logo', 'favicon', 'social_image', 'other_link']) {
      out[k] = String(b[k] || '').slice(0, 1000);
    }
    for (const k of ['logo', 'favicon', 'social_image']) {
      if (out[k] && !TorAdmin.publicImgOk(out[k])) return json(res, 400, { error: 'invalid_asset_path' });
    }
    if (out.other_link && !TorAdmin.urlOk(out.other_link)) return json(res, 400, { error: 'https_required' });
    out.arabic_enabled = b.arabic_enabled === true;
    out.mode = b.mode === 'light' ? 'light' : 'dark';
    out.gold = /^#[A-Fa-f0-9]{6}$/.test(b.gold || '') ? b.gold : '#D7B776';
    out.font_ar = b.font_ar === 'Tajawal' ? 'Tajawal' : 'IBM Plex Sans Arabic';
    out.default_language = b.default_language === 'ar' ? 'ar' : 'en';
    if (!out.arabic_enabled) {
      if (!out.name_ar && old.name_ar) out.name_ar = old.name_ar;
      if (!out.description_ar && old.description_ar) out.description_ar = old.description_ar;
      if (!b.font_ar && old.font_ar) out.font_ar = old.font_ar === 'Tajawal' ? 'Tajawal' : 'IBM Plex Sans Arabic';
      if (old.default_language === 'ar' || old.default_language === 'en') out.default_language = old.default_language;
    }
    out.base_url = String(b.base_url || '').replace(/\/$/, '');
    if (out.base_url && !TorAdmin.baseUrlOk(out.base_url)) return json(res, 400, { error: 'invalid_base_url' });
    writeJson(SITE_SETTINGS_FILE, out);
    if (out.arabic_enabled !== (old.arabic_enabled === true)) {
      audit(sess.username, 'site_settings', 'arabic_enabled', 'ok', out.arabic_enabled ? 'Arabic site enabled' : 'Arabic site disabled');
    } else {
      audit(sess.username, 'site_settings', 'settings', 'ok');
    }
    return json(res, 200, { status: 'saved' });
  }

  if (p === '/admin/api/password' && req.method === 'PUT') {
    if (!loginRateOk(ip)) return json(res, 429, { error: 'rate_limited' });
    const b = await readBody(req);
    const a = readJsonMutable(ADMIN_FILE, null);
    if (!a || !b || !scryptVerify(String(b.current || ''), a.pass)) return json(res, 403, { error: 'incorrect_current_password' });
    if (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 200) {
      return json(res, 400, { error: 'password_10_to_200_chars' });
    }
    a.pass = scryptHash(b.password);
    writeJson(ADMIN_FILE, a);
    sessions = {};
    saveSessions();
    res.setHeader('Set-Cookie', 'tor_admin=; ' + COOKIE_FLAGS + '; Max-Age=0');
    audit(sess.username, 'password_change', 'admin', 'ok');
    return json(res, 200, { status: 'changed_sign_in_again' });
  }

  if (p === '/admin/api/preview-content' && req.method === 'GET') {
    const st = getStore();
    const cols = structuredClone(st.collections);
    for (const list of Object.values(cols)) {
      if (Array.isArray(list)) for (const x of list) x.hidden = false;
    }
    const safe = v => JSON.stringify(v).replace(/</g, '\\u003c');
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(
      'const SITE_SETTINGS={};const SITE_CONTENT=' + safe({ fields: seedFields(), defaults: st.fixedDefaults })
      + ';const SITE_COLLECTIONS=' + safe(cols) + ';'
    );
  }

  // --- content read (collections normalized for the admin UI; raw fields preserved) ---
  if (p === '/admin/api/content' && req.method === 'GET') {
    const st = getStore();
    const solves = readJson(SOLVES_FILE, {});
    const bi = (v, alt) => (v && typeof v === 'object') ? v : { ar: (typeof v === 'string' ? v : (alt || '')), en: (typeof v === 'string' ? v : (alt || '')) };
    const cols = Object.assign({}, st.collections, {
      challenges: (st.collections.challenges || []).map(c => {
        const t = bi(c.title), e = bi(c.excerpt || c.description), cat = bi(c.category), dif = bi(c.difficulty || c.level);
        return Object.assign({}, c, {
          title_ar: t.ar || '', title_en: t.en || '',
          excerpt_ar: e.ar || '', excerpt_en: e.en || '',
          category_ar: cat.ar || '', category_en: cat.en || '',
          difficulty_ar: dif.ar || '', difficulty_en: dif.en || '',
          available: c.availability === 'open',
          archived: c.availability === 'archived' || c.status === 'archived',
          sample: c.sample === true,
          solves: Object.values(solves).filter(byChallenge => byChallenge && byChallenge[c.id]).length
        });
      }),
      articles: (st.collections.articles || []).map(a => {
        const t = bi(a.title), e = bi(a.excerpt || a.description);
        return Object.assign({}, a, {
          title_ar: t.ar || '', title_en: t.en || '',
          excerpt_ar: e.ar || '', excerpt_en: e.en || '',
          available: a.availability !== 'soon',
          sample: a.sample === true
        });
      }),
      investigations: (st.collections.investigations || []).map(iv => {
        const t = bi(iv.title), s = bi(iv.summary);
        return Object.assign({}, iv, { title_ar: t.ar || '', title_en: t.en || '', summary_ar: s.ar || '', summary_en: s.en || '' });
      })
    });
    let fixedFields = [];
    try { fixedFields = seedFields() || []; } catch (e) {}
    return json(res, 200, { fixed: st.fixedDefaults, fixedFields, collections: cols });
  }

  // --- fixed site fields (site texts): validated against the declared field list ---
  if (p === '/admin/api/content/fixed' && req.method === 'PUT') {
    const body = await readBody(req, 1024 * 1024);
    if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
    const values = body && body.values;
    if (!values || typeof values !== 'object') return json(res, 400, { error: 'invalid' });
    let declared = [];
    try { declared = (seedFields() || []).map(f => f.page + ':' + f.key); } catch (e) {}
    const st2 = getStoreMutable();
    const bad = [];
    const arOn = isArabicEnabled();
    Object.keys(values).forEach(k => {
      // keys look like "index-ar:hero-title"; validate the "page:key" part is declared
      const m = k.match(/^([a-z-]+)-(ar|en):(.+)$/);
      if (!m || !declared.includes(m[1] + ':' + m[3]) || typeof values[k] !== 'string' || values[k].length > 4000) {
        bad.push(k);
        return;
      }
      if (!arOn && m[2] === 'ar' && values[k] === '' && st2.fixedDefaults[k]) return;
      st2.fixedDefaults[k] = values[k];
    });
    if (bad.length) return json(res, 400, { error: 'invalid_keys', details: bad.slice(0, 5) });
    publishStore(st2);
    audit(sess.username, 'fixed_update', 'site-fields', 'ok', String(Object.keys(values).length) + ' keys');
    return json(res, 200, { status: 'updated', count: Object.keys(values).length });
  }

  // --- challenges & articles CRUD (validated with the shared schema) ---
  const chMatch = p.match(/^\/admin\/api\/challenges(?:\/([a-z0-9-]+))?$/);
  if (chMatch) return handleEntryCrud(req, res, sess, chMatch[1], 'challenges');

  const artMatch = p.match(/^\/admin\/api\/articles(?:\/([a-z0-9-]+))?$/);
  if (artMatch) return handleEntryCrud(req, res, sess, artMatch[1], 'articles');

  // --- archive / restore ---
  const arMatch = p.match(/^\/admin\/api\/challenges\/([a-z0-9-]+)\/archive$/);
  if (arMatch && req.method === 'POST') {
    const body2 = await readBody(req);
    const st2 = getStoreMutable();
    const entry2 = st2.collections.challenges.find(c => c.id === arMatch[1]);
    if (!entry2) return json(res, 404, { error: 'not_found' });
    const arch = !!(body2 && body2.archived);
    entry2.availability = arch ? 'archived' : 'open';
    entry2.hidden = arch;
    entry2.status = arch ? 'archived' : 'published';
    publishStore(st2);
    audit(sess.username, 'challenge_archive', entry2.id, arch ? 'archived' : 'restored');
    return json(res, 200, { status: arch ? 'archived' : 'restored', id: entry2.id });
  }

  // --- flag configuration: scrypt hash only, never returns plaintext, replace needs confirm ---
  const flMatch = p.match(/^\/admin\/api\/challenges\/([a-z0-9-]+)\/flag$/);
  if (flMatch) {
    if (req.method === 'GET') {
      const flags = readJson(FLAGS_FILE, {});
      return json(res, 200, { challenge: flMatch[1], ...formatFlagMeta(flags[flMatch[1]]) });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      let flag = String(body && body.flag || '').trim();
      if (!flag || flag.length > 200) return json(res, 400, { error: 'bad_flag' });
      const flags = readJsonMutable(FLAGS_FILE, {});
      const has = !!flags[flMatch[1]];
      const policy = flags._policy || {};
      if (policy.format_hint) {
        let re; try { re = new RegExp(policy.format_hint); } catch (e) { re = null; }
        if (re && !re.test(flag)) return json(res, 400, { error: 'format_mismatch', detail: 'flag must match ' + policy.format_hint });
      }
      if (policy.case_sensitive === false) flag = flag.toLowerCase();
      if (has && body.confirm_replace !== true) return json(res, 409, { error: 'needs_confirm', detail: 'replacing an existing flag requires confirm_replace:true' });
      const salt = crypto.randomBytes(16).toString('hex');
      const scrypt = crypto.scryptSync(flag, salt, 32).toString('hex');
      flags[flMatch[1]] = { algo: 'scrypt', salt, scrypt };
      writeJson(FLAGS_FILE, flags);
      audit(sess.username, has ? 'flag_replace' : 'flag_set', flMatch[1], 'ok');
      return json(res, 200, { status: has ? 'replaced' : 'set', ...formatFlagMeta(flags[flMatch[1]]) });
    }
  }

  // --- media library: reads builtin + TOR_DATA_DIR/assets, writes ONLY to TOR_DATA_DIR/assets ---
  if (p === '/admin/api/media' && req.method === 'GET') {
    const readMediaMap = dirPath => {
      const m = new Map();
      try {
        for (const f of fs.readdirSync(dirPath)) {
          const stf = fs.statSync(path.join(dirPath, f));
          if (stf.isFile()) m.set(f, stf);
        }
      } catch (e) {}
      return m;
    };
    const builtinMap = readMediaMap(BUILTIN_MEDIA_DIR);
    const customMap = readMediaMap(MEDIA_DIR);
    const names = new Set([...builtinMap.keys(), ...customMap.keys()]);
    const out = [];
    for (const f of names) {
      const bStat = builtinMap.get(f);
      const cStat = customMap.get(f);
      const stf = cStat || bStat;
      const ext = (f.split('.').pop() || '').toLowerCase();
      out.push({
        name: f,
        bytes: stf.size,
        mtime: stf.mtime.toISOString(),
        kind: /^jpe?g|png|gif|webp|svg|avif$/.test(ext) ? 'image' : ext,
        builtin: !!bStat,
        overridden: !!(bStat && cStat)
      });
    }
    out.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return json(res, 200, { media: out });
  }

  if (p === '/admin/api/media' && req.method === 'POST') {
    const body = await readBody(req, 6 * 1024 * 1024);
    const name = String(body && body.name || '').trim();
    const b64 = String(body && body.data_b64 || '');
    const replace = !!(body && body.replace === true);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}\.(jpe?g|png|gif|webp)$/.test(name)) {
      return json(res, 400, { error: 'bad_name', detail: 'raster images only: jpg png gif webp (svg not allowed)' });
    }
    if (name.includes('..')) return json(res, 400, { error: 'bad_name' });
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return json(res, 400, { error: 'bad_data' });
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > 4 * 1024 * 1024) return json(res, 400, { error: 'bad_size', detail: 'max 4 MB' });
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!sniffImage(buf, ext)) return json(res, 400, { error: 'bad_content', detail: 'file content does not match a real ' + ext + ' image' });
    const fp = path.join(MEDIA_DIR, name);
    const builtinFp = path.join(BUILTIN_MEDIA_DIR, name);
    const exists = fs.existsSync(fp) || fs.existsSync(builtinFp);
    if (exists && !replace) return json(res, 409, { error: 'exists', detail: 'file exists; send replace:true to overwrite' });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, fp);
    audit(sess.username, exists ? 'media_replace' : 'media_upload', name, 'ok', buf.length + ' bytes');
    return json(res, 200, { status: exists ? 'replaced' : 'uploaded', name, bytes: buf.length, overridden: fs.existsSync(builtinFp) });
  }

  const mediaDel = p.match(/^\/admin\/api\/media\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,80})$/);
  if (mediaDel && req.method === 'DELETE') {
    const name = mediaDel[1];
    if (name.includes('..') || name.includes('/')) return json(res, 400, { error: 'bad_name' });
    const fp = path.join(MEDIA_DIR, name);
    const builtinFp = path.join(BUILTIN_MEDIA_DIR, name);
    const hasCustom = fs.existsSync(fp);
    const hasBuiltin = fs.existsSync(builtinFp);
    if (!hasCustom && !hasBuiltin) return json(res, 404, { error: 'not_found' });
    if (!hasCustom && hasBuiltin) {
      return json(res, 403, { error: 'builtin_asset', detail: 'built-in site assets are read-only; upload a replacement instead' });
    }
    const refs = hasBuiltin ? [] : assetRefs(name);
    const force = (req.headers['x-force'] === '1');
    if (refs.length && !force) {
      return json(res, 409, { error: 'referenced', refs, detail: 'file is referenced by site pages/content; resend with x-force:1 to delete anyway' });
    }
    fs.unlinkSync(fp);
    audit(sess.username, hasBuiltin ? 'media_restore' : 'media_delete', name, 'ok', refs.length ? 'forced, was referenced by ' + refs.join(',') : '');
    return json(res, 200, { status: hasBuiltin ? 'restored' : 'deleted', name, restored_builtin: hasBuiltin, was_referenced: refs });
  }

  // --- tags/categories rename across collections ---
  if (p === '/admin/api/content/rename-tag' && req.method === 'POST') {
    const body = await readBody(req);
    const from = String(body && body.from || '').trim();
    const to = String(body && body.to || '').trim();
    if (!from || !to || to.length > 80) return json(res, 400, { error: 'invalid' });
    const st3 = getStoreMutable();
    let touched = 0;
    ['challenges', 'articles', 'investigations'].forEach(col => {
      (st3.collections[col] || []).forEach(it => {
        if (Array.isArray(it.tags) && it.tags.includes(from)) {
          it.tags = it.tags.map(t => t === from ? to : t);
          touched++;
        }
      });
    });
    if (!touched) return json(res, 404, { error: 'tag_not_found' });
    publishStore(st3);
    audit(sess.username, 'tag_rename', from + ' -> ' + to, 'ok', touched + ' items');
    return json(res, 200, { status: 'renamed', touched });
  }

  // --- generic collections (investigations / categories / tags): schema-driven CRUD ---
  const gcMatch = p.match(/^\/admin\/api\/collection\/([a-z]+)(?:\/([a-z0-9-]+))?$/);
  if (gcMatch && SCHEMAS[gcMatch[1]]) {
    const col = gcMatch[1], schema = SCHEMAS[col];
    if (req.method === 'POST' && !gcMatch[2]) {
      const body = await readBody(req, 1024 * 1024);
      if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid' });
      const arOn = isArabicEnabled();
      const id = String(body.id || '').trim();
      const errs = [];
      const item = cleanBySchema(schema, body, id, { arabicEnabled: arOn, errors: errs });
      if (!item || !/^[a-z0-9][a-z0-9-]{1,59}$/.test(item.id)) return json(res, 400, { error: 'invalid', details: errs });
      const st4 = getStoreMutable();
      st4.collections[col] = st4.collections[col] || [];
      const list = st4.collections[col];
      if (col === 'investigations' ? checkSlugConflict(list, item, null, arOn) : list.some(x => x.id === item.id)) {
        return json(res, 409, { error: 'duplicate_id' });
      }
      list.push(item);
      publishStore(st4);
      audit(sess.username, col + '_create', item.id, 'ok');
      return json(res, 200, { status: 'created', id: item.id });
    }
    if (req.method === 'PUT' && gcMatch[2]) {
      const body = await readBody(req, 1024 * 1024);
      if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid' });
      const st4 = getStoreMutable();
      st4.collections[col] = st4.collections[col] || [];
      const list = st4.collections[col];
      const it = list.find(x => x.id === gcMatch[2]);
      if (!it) return json(res, 404, { error: 'not_found' });
      const arOn = isArabicEnabled();
      const mergedInput = { ...body };
      for (const f of schema.fields) {
        if (mergedInput[f.k] === undefined && it[f.k] !== undefined) mergedInput[f.k] = it[f.k];
      }
      if (mergedInput.hidden === undefined && it.hidden !== undefined) mergedInput.hidden = it.hidden;
      const payload = arOn ? mergedInput : mergeArabic(mergedInput, it);
      const errs = [];
      const item = cleanBySchema(schema, payload, gcMatch[2], { arabicEnabled: arOn, errors: errs });
      if (!item) return json(res, 400, { error: 'invalid', details: errs });
      if (col === 'investigations' && checkSlugConflict(list, item, it.id, arOn)) {
        return json(res, 409, { error: 'duplicate_slug' });
      }
      list[list.indexOf(it)] = item;
      publishStore(st4);
      audit(sess.username, col + '_update', item.id, 'ok');
      return json(res, 200, { status: 'updated', id: item.id });
    }
    const st4 = getStoreMutable();
    st4.collections[col] = st4.collections[col] || [];
    const list = st4.collections[col];
    const it = list.find(x => x.id === gcMatch[2]);
    if (!it) return json(res, 404, { error: 'not_found' });
    if (req.method === 'DELETE') {
      it.hidden = true;
      publishStore(st4);
      audit(sess.username, col + '_archive', it.id, 'ok');
      return json(res, 200, { status: 'archived', id: it.id });
    }
    if (req.method === 'GET') return json(res, 200, { item: it });
  }

  // --- SEO: stored in TOR_DATA_DIR/seo.json and injected dynamically per response ---
  if (p === '/admin/api/seo' && req.method === 'GET') {
    return json(res, 200, { seo: readJson(SEO_FILE, { ar: { description: '', keywords: '' }, en: { description: '', keywords: '' } }) });
  }
  if (p === '/admin/api/seo' && req.method === 'PUT') {
    const body = await readBody(req);
    if (TOO_LARGE_REQS.has(req)) return json(res, 413, { error: 'payload_too_large' });
    const seo = readJsonMutable(SEO_FILE, {});
    const arOn = isArabicEnabled();
    ['ar', 'en'].forEach(lang => {
      const d = body && body[lang] || {};
      const desc = String(d.description || '').slice(0, 300);
      const kw = String(d.keywords || '').slice(0, 300);
      if (!arOn && lang === 'ar' && !desc && !kw && seo.ar) return;
      seo[lang] = { description: desc, keywords: kw };
    });
    writeJson(SEO_FILE, seo);
    audit(sess.username, 'seo_update', 'meta', 'ok');
    return json(res, 200, { status: 'saved', pages: arOn ? 10 : 5 });
  }

  // --- flag policy: format + case rules (stored under _policy in flags.json, never a challenge) ---
  if (p === '/admin/api/flag-policy' && req.method === 'GET') {
    const flags = readJson(FLAGS_FILE, {});
    const pol = flags._policy || {};
    return json(res, 200, { case_sensitive: pol.case_sensitive !== false, format_hint: pol.format_hint || '' });
  }
  if (p === '/admin/api/flag-policy' && req.method === 'PUT') {
    const body = await readBody(req);
    const flags = readJsonMutable(FLAGS_FILE, {});
    const hint = String(body && body.format_hint || '').trim();
    if (hint) { try { new RegExp(hint); } catch (e) { return json(res, 400, { error: 'bad_regex' }); } }
    flags._policy = { case_sensitive: body && body.case_sensitive !== false, format_hint: hint };
    writeJson(FLAGS_FILE, flags);
    audit(sess.username, 'flag_policy', '_policy', 'ok', JSON.stringify(flags._policy));
    return json(res, 200, { status: 'saved', case_sensitive: flags._policy.case_sensitive, format_hint: hint });
  }

  // --- challenge duplicate ---
  const chDup = p.match(/^\/admin\/api\/challenges\/([a-z0-9-]+)\/duplicate$/);
  if (chDup && req.method === 'POST') {
    const store = getStoreMutable();
    const list = store.collections.challenges || [];
    const src = list.find(c => c.id === chDup[1]);
    if (!src) return json(res, 404, { error: 'not_found' });
    let nid = src.id + '-copy', n = 2;
    while (list.some(c => c.id === nid)) { nid = src.id + '-copy-' + (n++); }
    const copy = structuredClone(src);
    copy.id = nid;
    copy.hidden = true;
    copy.status = 'draft';
    copy.slug = { ar: '', en: '' };
    copy.featured = false;
    if (copy.title) {
      if (copy.title.ar) copy.title.ar += ' (نسخة)';
      if (copy.title.en) copy.title.en += ' (copy)';
    }
    list.push(copy);
    publishStore(store);
    audit(sess.username, 'challenge_duplicate', src.id, 'ok', 'new id ' + nid + ' (hidden; flag NOT copied)');
    return json(res, 200, { status: 'duplicated', id: nid });
  }

  // --- player disable/enable (enforced by the public submit API) ---
  const plDis = p.match(/^\/admin\/api\/players\/([a-f0-9]{32})\/disabled$/);
  if (plDis && req.method === 'POST') {
    const body = await readBody(req);
    const st = readJsonMutable(PLAYERS_STATE_FILE, { disabled: [] });
    st.disabled = st.disabled || [];
    const on = !(body && body.disabled === false);
    if (on && !st.disabled.includes(plDis[1])) st.disabled.push(plDis[1]);
    if (!on) st.disabled = st.disabled.filter(x => x !== plDis[1]);
    writeJson(PLAYERS_STATE_FILE, st);
    audit(sess.username, on ? 'player_disable' : 'player_enable', plDis[1], 'ok');
    return json(res, 200, { status: on ? 'disabled' : 'enabled' });
  }

  // --- submissions / players / stats / audit ---
  if (p === '/admin/api/submissions' && req.method === 'GET') {
    let rows = readJsonLinesCached(SUBMISSIONS_FILE);
    const ch = url.searchParams.get('challenge');
    const result = url.searchParams.get('result');
    if (ch) rows = rows.filter(r => r.challenge === ch);
    if (result) rows = rows.filter(r => r.result === result);
    return json(res, 200, { submissions: rows.slice(-500).reverse() });
  }

  if (p === '/admin/api/players' && req.method === 'GET') {
    const solves = readJson(SOLVES_FILE, {});
    const pNames = readJson(PLAYER_NAMES_FILE, {});
    const subs = readJsonLinesCached(SUBMISSIONS_FILE);
    const players = {};
    subs.forEach(s => {
      const pl = players[s.identity] = players[s.identity] || { identity: s.identity, name: s.name || '', submissions: 0, correct: 0, first: s.ts, last: s.ts };
      if (s.name && (!pl.name || pl.name === 'Anonymous')) pl.name = s.name;
      pl.submissions++;
      if (s.result === 'correct') pl.correct++;
      if (s.ts < pl.first) pl.first = s.ts;
      if (s.ts > pl.last) pl.last = s.ts;
    });
    Object.keys(solves).forEach(id => {
      const pl = players[id] = players[id] || { identity: id, name: pNames[id] || '', submissions: 0, correct: 0, first: null, last: null };
      if ((!pl.name || pl.name === 'Anonymous') && pNames[id]) pl.name = pNames[id];
      pl.solved = Object.keys(solves[id]);
    });
    const pst = readJson(PLAYERS_STATE_FILE, { disabled: [] });
    (pst.disabled || []).forEach(id => { if (players[id]) players[id].disabled = true; });
    return json(res, 200, { players: Object.values(players) });
  }

  if (p === '/admin/api/stats' && req.method === 'GET') {
    const st = getStore();
    const solves = readJson(SOLVES_FILE, {});
    const subRows = readJsonLinesCached(SUBMISSIONS_FILE);
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      days.push(d.toISOString().slice(0, 10));
    }
    const byDay = {};
    days.forEach(d => { byDay[d] = 0; });
    const solvesByDay = {};
    const byResult = {};
    subRows.forEach(r => {
      const d = String(r.ts || '').slice(0, 10);
      if (d in byDay) {
        byDay[d]++;
        if (r.result === 'correct') solvesByDay[d] = (solvesByDay[d] || 0) + 1;
      }
      byResult[r.result] = (byResult[r.result] || 0) + 1;
    });
    const perChallenge = {};
    Object.values(solves).forEach(m => Object.keys(m).forEach(ch => { perChallenge[ch] = (perChallenge[ch] || 0) + 1; }));
    const publicChallenges = st.collections.challenges.filter(c => isPublic(c));
    return json(res, 200, {
      challenges: st.collections.challenges.length,
      challenges_published: publicChallenges.length,
      challenges_available: publicChallenges.filter(c => c.availability === 'open').length,
      articles: st.collections.articles.length,
      investigations: (st.collections.investigations || []).length,
      investigations_public: (st.collections.investigations || []).filter(iv => isPublicInvestigation(iv)).length,
      total_solves: Object.values(solves).reduce((a, s) => a + Object.keys(s).length, 0),
      total_submissions: subRows.length,
      players: new Set([...Object.keys(solves), ...subRows.map(r => r.identity)]).size,
      challenges_preparation: st.collections.challenges.filter(c => c.availability === 'soon' && !c.hidden && c.status !== 'draft').length,
      evidence_count: st.collections.challenges.reduce((n, c) => n + (c.artifacts || []).length, 0),
      evidence_hosted_bytes: 0,
      chart_days: days.map(d => ({ day: d, submissions: byDay[d], solves: solvesByDay[d] || 0 })),
      chart_results: byResult,
      chart_solves: perChallenge,
      demo_data: true
    });
  }

  if (p === '/admin/api/audit' && req.method === 'GET') {
    const rows = readJsonLinesCached(AUDIT_FILE);
    return json(res, 200, { audit: rows.slice(-200).reverse() });
  }

  return json(res, 404, { error: 'not_found' });
}

const AR_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
function stripArabicValue(v) {
  if (Array.isArray(v)) return v.map(stripArabicValue);
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === 'ar' || /_ar$/i.test(k) || /Ar$/.test(k)) continue;
    out[k] = stripArabicValue(val);
  }
  return out;
}
function stripArabicFromPayload(settings, fixedDefaults, collections) {
  const cleanSettings = stripArabicValue(settings || {});
  delete cleanSettings.font_ar;
  const cleanDefaults = {};
  for (const [k, v] of Object.entries(fixedDefaults || {})) {
    if (/^[a-z]+-ar:/i.test(k) || AR_SCRIPT_RE.test(String(v || ''))) continue;
    cleanDefaults[k] = v;
  }
  const cleanCols = stripArabicValue(collections || {});
  return { settings: cleanSettings, defaults: cleanDefaults, collections: cleanCols };
}

function nextScheduledPublishMs(collections, now) {
  let earliest = Infinity;
  for (const key of ['challenges', 'articles', 'investigations']) {
    const list = collections && collections[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && item.publish_at) {
        const t = Date.parse(item.publish_at);
        if (Number.isFinite(t) && t > now && t < earliest) earliest = t;
      }
    }
  }
  return earliest;
}

// Public serialization excludes private/draft records. Walkthroughs of public
// challenges remain intentionally revealable without a solve gate.
let contentJsCache = null;
function publicContentScript() {
  const now = Date.now();
  const sig = [
    statSig(STORE_FILE),
    statSig(SITE_SETTINGS_FILE),
    process.env.TOR_SHOW_SAMPLES === '1' ? '1' : '0',
    require('./visibility').solutionsGated() ? '1' : '0'
  ].join('|');
  if (contentJsCache && contentJsCache.sig === sig && now < contentJsCache.nextPublishMs) {
    return contentJsCache.script;
  }
  const store = getStore();
  const cleanDefaults = {};
  for (const [k, v] of Object.entries(store.fixedDefaults || {})) {
    cleanDefaults[k] = isPlaceholder(v) ? '' : v;
  }
  let settings = readJson(SITE_SETTINGS_FILE, {});
  let collections = publicCollections(store.collections, now);
  const arabic = isArabicEnabled();
  let finalDefaults = cleanDefaults;
  if (!arabic) {
    const stripped = stripArabicFromPayload(settings, cleanDefaults, collections);
    settings = stripped.settings;
    finalDefaults = stripped.defaults;
    collections = stripped.collections;
  }
  const rawFields = seedFields();
  const finalFields = arabic ? rawFields : rawFields.map(f => {
    const nf = { ...f };
    if (AR_SCRIPT_RE.test(String(nf.label || ''))) nf.label = nf.key;
    if (AR_SCRIPT_RE.test(String(nf.group || ''))) nf.group = nf.page || 'general';
    return nf;
  });
  const fixed = { fields: finalFields, defaults: finalDefaults };
  const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const script = 'var SITE_CONFIG = ' + safeJson({ arabic }) + '; if (typeof window !== "undefined") window.SITE_CONFIG = SITE_CONFIG;\n'
    + 'const SITE_SETTINGS = ' + safeJson(settings) + ';\n'
    + 'const SITE_CONTENT = ' + safeJson(fixed) + ';\n'
    + 'const SITE_COLLECTIONS = ' + safeJson(collections) + ';\n';
  contentJsCache = { sig, nextPublishMs: nextScheduledPublishMs(store.collections, now), script };
  return script;
}

function getPublicChallengeIds() {
  const now = Date.now();
  const set = new Set();
  for (const c of (getStore().collections.challenges || [])) {
    if (isPublic(c, now)) set.add(c.id);
  }
  return set;
}

function getOpenChallengeIds() {
  const now = Date.now();
  const set = new Set();
  for (const c of (getStore().collections.challenges || [])) {
    if (isPublic(c, now) && c.availability === 'open') set.add(c.id);
  }
  return set;
}

function challengeIsPublic(id) {
  const challenge = (getStore().collections.challenges || []).find(c => c.id === id);
  return isPublic(challenge);
}

function challengeIsOpen(id) {
  const challenge = (getStore().collections.challenges || []).find(c => c.id === id);
  return isPublic(challenge) && challenge.availability === 'open';
}

function mergeArabic(incoming, existing) {
  if (!existing || typeof existing !== 'object') return incoming;
  if (Array.isArray(incoming) && Array.isArray(existing)) {
    return incoming.map((item, i) => {
      if (item && typeof item === 'object') {
        if (typeof item.name === 'string' && item.name) {
          const byName = existing.find(x => x && x.name === item.name);
          if (byName) return mergeArabic(item, byName);
        }
        if (item.type && existing[i] && existing[i].type && item.type !== existing[i].type) {
          return item;
        }
      }
      return mergeArabic(item, existing[i]);
    });
  }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
  const out = { ...incoming };
  for (const [k, exVal] of Object.entries(existing)) {
    const isArKey = k === 'ar' || /_ar$/i.test(k) || /Ar$/.test(k);
    if (isArKey) {
      if ((out[k] === undefined || out[k] === '') && exVal !== undefined && exVal !== '') {
        out[k] = exVal;
      }
    } else if (out[k] && typeof out[k] === 'object' && exVal && typeof exVal === 'object') {
      out[k] = mergeArabic(out[k], exVal);
    }
  }
  return out;
}

function isArabicEnabled() {
  const s = readJson(SITE_SETTINGS_FILE, {});
  return s.arabic_enabled === true;
}

module.exports = {
  handle,
  publicContentScript,
  challengeIsOpen,
  challengeIsPublic,
  getPublicChallengeIds,
  getOpenChallengeIds,
  isArabicEnabled,
  stripArabicValue,
  getSession
};
