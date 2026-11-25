'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const TESTS = [
  'tests/public-boundaries.cjs',
  'tests/admin-regression.cjs',
  'tests/visibility-collections.cjs',
  'tests/no-placeholders.cjs',
  'tests/seo-meta.cjs',
  'tests/cache-compression.cjs',
  'tests/bugs-consistency.cjs',
  'tests/features-phase6.cjs',
  'tests/arabic-toggle.cjs'
];

const root = path.resolve(__dirname, '..');
for (const t of TESTS) {
  const res = spawnSync(process.execPath, [path.join(root, t)], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('FAILED:', t);
    process.exit(res.status || 1);
  }
}
console.log('\nALL TEST SUITES PASSED.');
