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

    // 6.2 Inline Markdown parser safety (DOM-only, no innerHTML, literal <img onerror>)
    const vm = require('node:vm');
    const sjs = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    const fnMatch = sjs.match(/function renderInlineMd\(parent, text\) \{[\s\S]*?\n  \}/);
    assert.ok(fnMatch, 'renderInlineMd exists in script.js');
    const nodes = [];
    const mockDoc = {
      createTextNode: t => ({ type: 'text', textContent: t }),
      createElement: tag => ({ tag, className: '', textContent: '', href: '', target: '', rel: '' })
    };
    const ctx = { document: mockDoc, TOR: { urlOk: u => /^https:\/\/.+\..+/.test(u) } };
    vm.runInNewContext(fnMatch[0], ctx);
    const parent = { appendChild: n => nodes.push(n) };
    ctx.renderInlineMd(parent, 'Hi **bold** *em* `cmd` [ok](https://ex.com) [bad](javascript:alert(1)) <img onerror=1>');
    check(nodes.some(n => n.tag === 'strong' && n.textContent === 'bold'), 'inline markdown renders <strong>');
    check(nodes.some(n => n.tag === 'em' && n.textContent === 'em'), 'inline markdown renders <em>');
    check(nodes.some(n => n.tag === 'code' && n.textContent === 'cmd'), 'inline markdown renders <code>');
    check(nodes.some(n => n.tag === 'a' && n.href === 'https://ex.com' && n.rel === 'noopener noreferrer'), 'inline markdown renders safe https link');
    check(!nodes.some(n => n.tag === 'img') && nodes.some(n => n.type === 'text' && n.textContent.includes('<img onerror=1>')), 'inline markdown keeps HTML literal (no XSS)');
    check(!nodes.some(n => n.tag === 'a' && /javascript:/i.test(n.href)), 'inline markdown rejects javascript: links');

    // 6.3 MITRE ATT&CK validation
    const val = require('../server/validators');
    const atkRes = val.validateCollections({
      articles: [{ id: 'atk-1', title: { ar: 'ع', en: 'E' }, excerpt: { ar: '', en: '' }, slug: { ar: 'ع', en: 'e' }, attack: ['T1059.001', 'INVALID', 'T1190'], sections: [] }],
      challenges: []
    });
    check(atkRes.ok && JSON.stringify(atkRes.value.articles[0].attack) === JSON.stringify(['T1059.001', 'T1190']), 'ATT&CK validator keeps valid techniques and drops invalid ones');

    // 6.4 Scheduled publication with mocked clock
    const vis = require('../server/visibility');
    const schedCols = {
      articles: [{ id: 'sched-1', status: 'published', publish_at: '2030-01-01T00:00:00Z', title: { en: 'Future' } }],
      challenges: [], investigations: []
    };
    check(vis.publicCollections(schedCols, Date.parse('2029-12-31T23:59:59Z')).articles.length === 0, 'scheduled item hidden before publish_at');
    check(vis.publicCollections(schedCols, Date.parse('2030-01-01T00:00:01Z')).articles.length === 1, 'scheduled item visible after publish_at');

    // 6.5 Hint penalty + idempotency + hidden hint blocked
    const stFile = path.join(root, 'server/data/store.json');
    const stObj = JSON.parse(fs.readFileSync(stFile, 'utf8'));
    stObj.collections.challenges[0].hints = [
      { ar: 'مدفوع', en: 'Paid hint', published: true, cost: 25 },
      { ar: 'مخفي', en: 'Hidden hint', published: false, cost: 10 }
    ];
    fs.writeFileSync(stFile, JSON.stringify(stObj));
    const h1 = await fetch(base + '/api/hint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge: 'log4shell-lab', index: 0, identity: id1 }) });
    const h1j = await h1.json();
    const h2 = await fetch(base + '/api/hint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge: 'log4shell-lab', index: 0, identity: id1 }) });
    const h2j = await h2.json();
    check(h1.status === 200 && h1j.penalty === 25 && h2j.penalty === 25, 'paid hint deducts once (idempotent)');
    const sbAfter = await (await fetch(base + '/api/scoreboard')).json();
    check(sbAfter.scoreboard.find(x => x.name === 'Alice').points === 125, 'scoreboard deducts paid hint cost (150 - 25 = 125)');
    const hHidden = await fetch(base + '/api/hint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge: 'log4shell-lab', index: 1, identity: id1 }) });
    check(hHidden.status === 404, 'hidden/unpublished hint cannot be revealed');

    // 6.6 Search pages + Arabic normalization
    check((await fetch(base + '/search-en.html')).status === 200 && (await fetch(base + '/search-ar.html')).status === 200, 'search-{en,ar}.html served');
    const sjs6 = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    const normMatch = sjs6.match(/function normSearch\(s\) \{[\s\S]*?\n  \}/);
    const ctx6 = {};
    vm.runInNewContext(normMatch[0], ctx6);
    check(ctx6.normSearch('إِختِبَارْ مَدْرَسَةٌ') === 'اختبار مدرسه', 'Arabic search normalization strips tashkeel and unifies alef/ta marbuta');

    console.log('TOTAL ' + count + ' phase-6 assertions passed');
  } finally {
    child.kill();
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
