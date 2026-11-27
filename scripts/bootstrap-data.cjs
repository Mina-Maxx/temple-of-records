'use strict';
// First-deploy helper: copies your LOCAL content into the production data directory.
//
//   TOR_DATA_DIR=/var/data node scripts/bootstrap-data.cjs            # copy only files that do not exist yet
//   TOR_DATA_DIR=/var/data node scripts/bootstrap-data.cjs --force    # overwrite existing content files
//   TOR_DATA_DIR=/var/data node scripts/bootstrap-data.cjs --with-flags   # also copy server/flags.json (scrypt/sha256 hashes)
//
// Copies ONLY content: store.json, site-settings.json, seo.json and uploaded images (assets/).
// It never touches admin.json, sessions, solves, players, verified, submissions or audit logs.
// Run it where the source files are (a checkout containing your server/data), against the target data dir.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const srcDir = process.env.TOR_SOURCE_DIR ? path.resolve(process.env.TOR_SOURCE_DIR) : path.join(root, 'server', 'data');
const dstDir = process.env.TOR_DATA_DIR ? path.resolve(process.env.TOR_DATA_DIR) : null;
const force = process.argv.includes('--force');
const withFlags = process.argv.includes('--with-flags');

if (!dstDir) { console.error('Set TOR_DATA_DIR to the production data directory (e.g. /var/data).'); process.exit(1); }
if (path.resolve(srcDir) === dstDir) { console.error('Source and target are the same directory; nothing to do.'); process.exit(1); }
fs.mkdirSync(dstDir, { recursive: true });

let copied = 0, skipped = 0;
function copyFile(from, to) {
  if (!fs.existsSync(from)) return;
  if (fs.existsSync(to) && !force) { console.log('skip (exists):', to); skipped++; return; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to); console.log('copied       :', to); copied++;
}
for (const f of ['store.json', 'site-settings.json', 'seo.json']) copyFile(path.join(srcDir, f), path.join(dstDir, f));
const imgs = path.join(srcDir, 'assets');
if (fs.existsSync(imgs)) for (const f of fs.readdirSync(imgs)) if (/^[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif|svg|avif)$/i.test(f)) copyFile(path.join(imgs, f), path.join(dstDir, 'assets', f));
if (withFlags) {
  const srcFlags = process.env.TOR_SOURCE_FLAGS ? path.resolve(process.env.TOR_SOURCE_FLAGS) : path.join(root, 'server', 'flags.json');
  const dstFlags = process.env.TOR_FLAGS_FILE ? path.resolve(process.env.TOR_FLAGS_FILE) : path.join(dstDir, 'flags.json');
  copyFile(srcFlags, dstFlags);
}
console.log(`done: ${copied} copied, ${skipped} skipped. Restart the service, then check the admin dashboard.`);
