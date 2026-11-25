'use strict';
// Backup script: copies TOR_DATA_DIR, TOR_FLAGS_FILE, and assets/ into backups/YYYYMMDD-HHMMSS/
// Usage: node scripts/backup.cjs [keepCount]
// Cron example (daily at 03:00): 0 3 * * * cd /opt/temple-of-records && node scripts/backup.cjs 7
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.TOR_DATA_DIR ? path.resolve(process.env.TOR_DATA_DIR) : path.join(root, 'server', 'data');
const flagsFile = process.env.TOR_FLAGS_FILE ? path.resolve(process.env.TOR_FLAGS_FILE) : path.join(root, 'server', 'flags.json');
const backupsDir = path.join(root, 'backups');
const keep = Math.max(1, parseInt(process.argv[2] || process.env.BACKUP_KEEP || '7', 10) || 7);

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const dest = path.join(backupsDir, stamp);

fs.mkdirSync(dest, { recursive: true });
if (fs.existsSync(dataDir)) fs.cpSync(dataDir, path.join(dest, 'data'), { recursive: true });
if (fs.existsSync(flagsFile)) fs.copyFileSync(flagsFile, path.join(dest, 'flags.json'));
const assetsDir = path.join(root, 'assets');
if (fs.existsSync(assetsDir)) fs.cpSync(assetsDir, path.join(dest, 'assets'), { recursive: true });

// Prune old backups, keeping last N
const dirs = fs.readdirSync(backupsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && /^\d{8}-\d{6}$/.test(d.name))
  .map(d => d.name)
  .sort();
while (dirs.length > keep) {
  const old = dirs.shift();
  fs.rmSync(path.join(backupsDir, old), { recursive: true, force: true });
}
console.log('Backup created:', dest, `(kept ${Math.min(keep, dirs.length + 1)} recent)`);
