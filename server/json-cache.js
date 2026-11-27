'use strict';
const fs = require('fs');

const cache = new Map();

function statSig(st) {
  return st.mtimeMs + ':' + st.ctimeMs + ':' + st.size;
}

/**
 * Reads and parses a JSON file with stat-based cache invalidation.
 * Returns a fresh default on error without caching missing files permanently.
 */
function readJsonCached(filePath, fallback) {
  let st;
  try {
    st = fs.statSync(filePath);
  } catch {
    cache.delete(filePath);
    return fallback;
  }
  const sig = statSig(st);
  const hit = cache.get(filePath);
  if (hit && hit.sig === sig) return hit.data;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (cache.size > 100) cache.clear();
    cache.set(filePath, { sig, data });
    return data;
  } catch {
    cache.delete(filePath);
    return fallback;
  }
}

function invalidateJsonCache(filePath) {
  if (filePath) cache.delete(filePath);
  else cache.clear();
}

function writeJsonAtomic(filePath, obj) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, filePath);
  try {
    const st = fs.statSync(filePath);
    cache.set(filePath, { sig: statSig(st), data: obj });
  } catch {
    cache.delete(filePath);
  }
}

// Append-only log with a size cap: when the file passes maxBytes it is moved to <file>.1
// (one generation kept), so submissions/audit logs can never fill the disk unnoticed.
function appendLogRotating(filePath, line, maxBytes) {
  const cap = maxBytes || 5 * 1024 * 1024;
  try {
    const st = fs.statSync(filePath);
    if (st.size > cap) { try { fs.renameSync(filePath, filePath + '.1'); } catch { /* keep appending */ } }
  } catch { /* file does not exist yet */ }
  fs.appendFileSync(filePath, line);
}

module.exports = { readJsonCached, invalidateJsonCache, writeJsonAtomic, appendLogRotating };
