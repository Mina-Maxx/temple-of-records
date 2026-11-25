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

module.exports = { readJsonCached, invalidateJsonCache, writeJsonAtomic };
