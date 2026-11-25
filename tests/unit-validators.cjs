'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const V = require('../server/validators');
const J = require('../server/json-cache');
const { isPlaceholder } = require('../server/placeholders');

let passed = 0;
function check(cond, msg) {
  assert(cond, msg);
  passed++;
  console.log('PASS', msg);
}

// cleanStr
check(V.cleanStr('hello <script>x</script>', 100) === 'hello <script>x</script>', 'cleanStr preserves raw text for HTML-escaped rendering');
check(V.cleanStr('a\x00\x07b\nc', 100) === 'ab\nc', 'cleanStr strips ASCII control chars except whitespace');
check(V.cleanStr('abcdef', 3) === null, 'cleanStr returns null when exceeding max length');
check(V.cleanStr(123, 10) === null, 'cleanStr returns null for non-strings');

// imgOk / publicImgOk / baseUrlOk / urlOk
check(V.imgOk('assets/hero-1.webp'), 'imgOk accepts relative assets/ image');
check(!V.imgOk('assets/../secret.png'), 'imgOk rejects path traversal');
check(!V.imgOk('https://evil.example/x.png'), 'imgOk rejects remote image URL');
check(!V.imgOk('data:image/svg+xml;base64,PHN2Zz4='), 'imgOk rejects active SVG data URI');
check(V.imgOk('data:image/png;base64,iVBORw0KGgo='), 'imgOk accepts raster data URI');

check(V.publicImgOk('assets/seal.png'), 'publicImgOk accepts assets/ path');
check(!V.publicImgOk('data:image/png;base64,iVBORw0KGgo='), 'publicImgOk rejects inline data URIs');

check(V.baseUrlOk('https://temple.example.org'), 'baseUrlOk accepts clean HTTPS origin');
check(!V.baseUrlOk('http://temple.example.org'), 'baseUrlOk rejects non-HTTPS origin');
check(!V.baseUrlOk('https://temple.example.org/'), 'baseUrlOk rejects trailing slash');
check(!V.baseUrlOk('https://temple.example.org/sub'), 'baseUrlOk rejects origin with path');

check(V.urlOk('https://github.com/org/repo'), 'urlOk accepts HTTPS URL');
check(!V.urlOk('javascript:alert(1)'), 'urlOk rejects javascript: URL');

// validateSection
check(V.validateSection({ type: 'paragraph', ar: 'نص', en: 'text' }, 's[0]', false).errors.length === 0, 'validateSection accepts valid paragraph section');
check(V.validateSection({ type: 'bogus', en: 'x' }, 's[0]', false).errors.length > 0, 'validateSection rejects unknown section type');
check(V.validateSection({ type: 'link', en: 'Download', url: 'http://bad.example/a' }, 's[0]', false).errors.length > 0, 'validateSection rejects non-HTTPS link url');
const codeRes = V.validateSection({ type: 'code', code: 'echo hi', label_en: 'cmd' }, 's[0]', true);
check(codeRes.errors.length === 0 && codeRes.value.zone === 'main', 'validateSection validates code section with default challenge zone');

// validateEntry & validateCollections
const validChallenge = {
  id: 'mem-forensics-1',
  slug: { ar: '', en: 'mem-forensics-1' },
  order: 3,
  title: { ar: '', en: 'Memory Forensics' },
  excerpt: { ar: '', en: 'Inspect Volatility plugin output' },
  category: { ar: '', en: 'Memory' },
  difficulty: { ar: '', en: 'Medium' },
  status: 'published',
  availability: 'open',
  date: '2026-01-15',
  artifacts: [{ name: 'mem.raw', type: 'RAW', size: '12 MB', sha256: 'a'.repeat(64), url: 'https://example.org/mem.zip', visibility: 'public' }],
  hints: [{ ar: '', en: 'Check pslist', published: true }],
  sections: [{ type: 'paragraph', zone: 'main', published: true, ar: '', en: 'Brief body' }]
};
const resEntry = V.validateEntry(validChallenge, 'challenges', 0, { arabicEnabled: false });
check(resEntry.errors.length === 0 && resEntry.value.order === 3, 'validateEntry accepts valid EN-only challenge and preserves numeric order');
check(resEntry.value.points === undefined, 'validateEntry never emits deprecated points field');

const badEntry = V.validateEntry({ id: 'Bad ID!', title: { en: 'x' } }, 'challenges', 0, { arabicEnabled: false });
check(badEntry.errors.length >= 1 && badEntry.value === null, 'validateEntry rejects invalid id format');

const colRes = V.validateCollections({ challenges: [validChallenge], articles: [] }, { arabicEnabled: false });
check(colRes.ok && colRes.value.challenges.length === 1, 'validateCollections accepts valid collection payload');

// placeholders helper
check(isPlaceholder('to be added later'), 'isPlaceholder catches EN placeholder');
check(isPlaceholder('تُضاف لاحقًا'), 'isPlaceholder catches AR placeholder');
check(!isPlaceholder('Log4Shell packet capture'), 'isPlaceholder leaves real text alone');

// json-cache readJsonCached / writeJsonAtomic / external modification invalidation
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-jsoncache-'));
try {
  const f = path.join(tmpDir, 'cfg.json');
  check(J.readJsonCached(f, { fallback: true }).fallback === true, 'readJsonCached returns fallback when missing');
  J.writeJsonAtomic(f, { step: 1 });
  check(J.readJsonCached(f, {}).step === 1, 'writeJsonAtomic writes and primes readJsonCached');
  fs.writeFileSync(f, JSON.stringify({ step: 2, extra: 'externally-written' }));
  const nowSec = Date.now() / 1000 + 2;
  fs.utimesSync(f, nowSec, nowSec);
  const reread = J.readJsonCached(f, {});
  check(reread.step === 2 && reread.extra === 'externally-written', 'readJsonCached invalidates on external file change');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('TOTAL', passed, 'unit assertions passed');
