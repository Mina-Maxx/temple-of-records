'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-p6-'));
fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: s => !s.includes(path.sep + '.git') });
let count = 0;
const check = (ok, label) => { assert.ok(ok, label); console.log('PASS ' + label); count++; };

(async () => {
  const port = 19451;
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(port), TOR_SHOW_SAMPLES: '1' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

    // 6.1 Scoreboard + opt-out
    const id1 = '11111111111111111111111111111111';
    const id2 = '22222222222222222222222222222222';
    const flag1 = 'TOR{198.51.100.44}';
    await fetch(base + '/api/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id1, name: 'Alice', challenge: 'log4shell-lab', flag: flag1 })
    });
    await fetch(base + '/api/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id2, name: 'SecretBob', hideName: true, challenge: 'log4shell-lab', flag: flag1 })
    });
    const sb = await (await fetch(base + '/api/scoreboard')).json();
    check(Array.isArray(sb.scoreboard) && sb.scoreboard.length === 2, 'scoreboard aggregates public solves');
    check(sb.scoreboard[0].name === 'Alice' && sb.scoreboard[0].firstBloods === 1 && sb.scoreboard[0].points === 150, 'scoreboard ranks Alice first with First Blood & 150 pts');
    check(sb.scoreboard[1].name === 'Anonymous', 'hideName opt-out masks player name as Anonymous');
    check(!JSON.stringify(sb).includes(id1) && !JSON.stringify(sb).includes('SecretBob'), 'scoreboard never leaks identity tokens or opted-out names');
    check((await fetch(base + '/scoreboard-en.html')).status === 200, 'scoreboard-en.html served');

    console.log('TOTAL ' + count + ' phase-6 assertions passed');
  } finally {
    child.kill();
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
