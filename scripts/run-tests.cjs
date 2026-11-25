'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const TESTS = [
  'tests/unit-validators.cjs',
  'tests/public-boundaries.cjs',
  'tests/admin-regression.cjs',
  'tests/visibility-collections.cjs',
  'tests/no-placeholders.cjs',
  'tests/seo-meta.cjs',
  'tests/cache-compression.cjs',
  'tests/bugs-consistency.cjs',
  'tests/features-phase6.cjs',
  'tests/arabic-toggle.cjs',
  'tests/hardening-regression.cjs'
];

const root = path.resolve(__dirname, '..');

// 0) Syntax check every JS file: catches errors that no server-side test would (e.g. a broken script.js).
const fs = require('node:fs');
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    if (['node_modules', '.git', 'backups'].includes(d.name)) return [];
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return jsFiles(p);
    return /\.(js|cjs)$/.test(d.name) ? [p] : [];
  });
}
for (const f of jsFiles(root)) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('SYNTAX ERROR in', path.relative(root, f) + '\n' + r.stderr); process.exit(1); }
}
console.log('PASS node --check on all JS files');

for (const t of TESTS) {
  const res = spawnSync(process.execPath, [path.join(root, t)], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('FAILED:', t);
    process.exit(res.status || 1);
  }
}
console.log('\nALL TEST SUITES PASSED.');
