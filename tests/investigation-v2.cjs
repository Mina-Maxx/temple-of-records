'use strict';
// Covers: investigation schema v2 (lab / evidence register / findings / MITRE / detections),
// editor<->schema parity, public visibility of the new fields, solver-list moderation,
// name sanitising, solution gating default, log rotation and the bootstrap script.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

let passed = 0;
const check = (c, m) => { assert(c, m); passed++; console.log('PASS', m); };

(async () => {
  // ---------- pure unit checks ----------
  // Windows checkouts use CRLF; normalise before parsing source text
  const adminSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'admin.js'), 'utf8').replace(/\r\n/g, '\n');
  const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'admin', 'investigations.html'), 'utf8').replace(/\r\n/g, '\n');
  const blockStart = adminSrc.indexOf('  investigations: {\n    fields: [');
  const block = adminSrc.slice(blockStart, adminSrc.indexOf('\n    ]\n  }', blockStart));
  const serverKeys = new Set([...block.matchAll(/\{ k: '([a-z_]+)', t: '([a-z0-9]+)'/g)].map(m => m[1]));
  const fStart = htmlSrc.search(/fields:\[\s*\{k:'g_overview'/);
  const fieldsHtml = htmlSrc.slice(fStart, htmlSrc.indexOf(']});', fStart));
  const editorTop = [...fieldsHtml.matchAll(/\{k:'([a-z_]+)',t:'(group|bi|str|enum|tags|rows|entries|links|code)'/g)].filter(m => m[2] !== 'group').map(m => m[1]);
  const editorKeys = new Set(editorTop.filter(k => serverKeys.has(k)));
  const topLevelServer = ['title', 'slug', 'summary', 'status', 'visibility', 'date', 'tags', 'attack', 'use_case', 'lab_environment', 'lab_components',
    'evidence_register', 'evidence', 'timeline', 'analysis', 'findings', 'findings_list', 'root_cause', 'mitre_mapping', 'detection_engineering', 'detections', 'lessons_learned', 'links'];
  check(topLevelServer.every(k => serverKeys.has(k)), 'server schema declares every v2 investigation field');
  check(topLevelServer.every(k => editorKeys.has(k)), 'admin editor exposes every v2 investigation field (schema parity)');

  const { solutionsGated } = require('../server/visibility');
  const keep = { ...process.env };
  delete process.env.TOR_GATE_SOLUTIONS; delete process.env.NODE_ENV; delete process.env.PORT;
  check(solutionsGated() === false, 'solutions are NOT gated for plain local runs');
  process.env.NODE_ENV = 'production'; check(solutionsGated() === true, 'solutions are gated by default in production');
  delete process.env.NODE_ENV; process.env.PORT = '10000'; check(solutionsGated() === true, 'solutions are gated by default on a PaaS PORT');
  process.env.TOR_GATE_SOLUTIONS = '0'; check(solutionsGated() === false, 'TOR_GATE_SOLUTIONS=0 overrides the production default');
  process.env.TOR_GATE_SOLUTIONS = '1'; delete process.env.PORT; check(solutionsGated() === true, 'TOR_GATE_SOLUTIONS=1 forces gating');
  for (const k of ['TOR_GATE_SOLUTIONS', 'NODE_ENV', 'PORT']) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }

  const { appendLogRotating } = require('../server/json-cache');
  const tmpLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tor-log-')), 'x.jsonl');
  for (let i = 0; i < 30; i++) appendLogRotating(tmpLog, 'x'.repeat(40) + '\n', 500);
  check(fs.existsSync(tmpLog + '.1') && fs.statSync(tmpLog).size <= 600, 'log files rotate to .1 once they pass the size cap');

  // bootstrap script copies content only
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-src-')), dstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-dst-'));
  for (const f of ['store.json', 'site-settings.json', 'admin.json', 'solves.json', 'sessions.json']) fs.writeFileSync(path.join(srcDir, f), '{"k":1}');
  fs.mkdirSync(path.join(srcDir, 'assets')); fs.writeFileSync(path.join(srcDir, 'assets', 'pic.png'), 'x'); fs.writeFileSync(path.join(srcDir, 'assets', 'evil.html'), 'x');
  fs.writeFileSync(path.join(dstDir, 'store.json'), '{"keep":true}');
  const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'bootstrap-data.cjs')], { env: { ...process.env, TOR_DATA_DIR: dstDir, TOR_SOURCE_DIR: srcDir }, encoding: 'utf8' });
  check(run.status === 0, 'bootstrap script runs');
  check(fs.readFileSync(path.join(dstDir, 'store.json'), 'utf8') === '{"keep":true}', 'bootstrap does not overwrite existing content without --force');
  check(fs.existsSync(path.join(dstDir, 'site-settings.json')) && fs.existsSync(path.join(dstDir, 'assets', 'pic.png')), 'bootstrap copies settings and images');
  check(!fs.existsSync(path.join(dstDir, 'admin.json')) && !fs.existsSync(path.join(dstDir, 'solves.json')) && !fs.existsSync(path.join(dstDir, 'sessions.json')) && !fs.existsSync(path.join(dstDir, 'assets', 'evil.html')),
    'bootstrap never copies admin/solves/sessions or non-image files');

  // ---------- server-level checks ----------
  const port = 18000 + Math.floor(Math.random() * 15000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-inv2-'));
  fs.cpSync(path.resolve(__dirname, '..'), root, { recursive: true, filter: s => !s.includes('.git') });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-inv2-data-'));
  const flagsFile = path.join(dataDir, 'flags.json');
  fs.writeFileSync(flagsFile, '{"_policy":{"case_sensitive":true}}');
  const env = { ...process.env, TOR_PORT: String(port), TOR_DATA_DIR: dataDir, TOR_FLAGS_FILE: flagsFile, ADMIN_USER: 'tester', ADMIN_PASSWORD: 'long-test-password-123' };
  delete env.PORT; delete env.NODE_ENV; delete env.TOR_GATE_SOLUTIONS;
  const proc = spawn(process.execPath, [path.join(root, 'server', 'server.js')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('server timeout')), 8000); proc.stdout.on('data', d => { if (String(d).includes('http://')) { clearTimeout(t); res(); } }); });
  const base = 'http://127.0.0.1:' + port;
  try {
    let cookie = '', csrf = '';
    const api = async (p, o = {}) => {
      const h = { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) };
      const r = await fetch(base + p, { method: o.method || 'GET', headers: h, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
      let j = null; try { j = await r.json(); } catch {}
      return { status: r.status, json: j, headers: r.headers };
    };
    let r = await api('/admin/api/login', { method: 'POST', body: { username: 'tester', password: 'long-test-password-123' } });
    cookie = r.headers.get('set-cookie').split(';')[0]; csrf = r.json.csrf;

    const hash = 'A'.repeat(64);
    const inv = {
      id: 'case-v2', title: { ar: 'ع', en: 'V2 case' }, summary: { ar: '', en: 'Sum' }, status: 'closed', visibility: 'public', date: '2026-11-25', tags: ['t'],
      use_case: { ar: '', en: 'USECASE_TEXT' }, lab_environment: { ar: '', en: 'LAB_TEXT' },
      lab_components: [{ host: 'WIN10-01', role: 'Victim', os_tools: 'Win10, Sysmon', notes: '' }, { host: '', role: '', os_tools: '', notes: '' }],
      evidence_register: [{ ref: 'EV-001', name: 'Memory dump', type: 'memory', source: 'WIN10-01', sha256: 'SHA256: ' + hash, acquired_at: '2026-11-01 10:00', notes: 'n', url: '' }],
      findings_list: [{ title: 'Persistence via Run key', severity: 'high', description: 'Found', evidence_ref: 'EV-001' }],
      mitre_mapping: [{ technique: 't1547.001', tactic: 'persistence', observation: 'Run key', detection_ref: 'DET-001' }],
      detections: [{ rule_id: 'DET-001', title: 'Run key persistence', status: 'tested', severity: 'high', use_case: 'UC', data_sources: 'Sysmon 13',
        sigma: 'title: Run key\ndetection:\n  sel: {}\n  condition: sel', spl: 'index=win EventCode=13', kql: 'DeviceRegistryEvents | take 1', other_lang: '', other_rule: '',
        false_positives: 'Installers', tuning: 'Exclude vendor paths', validation: 'Replayed in lab', attack: 't1547.001; T1112' }]
    };
    r = await api('/admin/api/collection/investigations', { method: 'POST', body: inv });
    check(r.status === 200, 'investigation with the v2 sections is accepted');
    r = await api('/admin/api/collection/investigations/case-v2');
    const saved = r.json.item;
    check(saved.lab_components.length === 1, 'empty rows are dropped');
    check(saved.evidence_register[0].sha256 === hash.toLowerCase(), 'SHA-256 is normalised (prefix stripped, lowercased)');
    check(saved.mitre_mapping[0].technique === 'T1547.001', 'ATT&CK technique id is normalised to upper case');
    check(saved.detections[0].attack === 'T1547.001, T1112', 'ATT&CK list is normalised');
    check(saved.detections[0].sigma.includes('condition: sel') && saved.detections[0].kql.startsWith('DeviceRegistryEvents'), 'Sigma / SPL / KQL bodies are kept verbatim');

    const bad = async (patch, label, needle) => {
      const x = await api('/admin/api/collection/investigations', { method: 'POST', body: { ...inv, id: 'case-bad', ...patch } });
      check(x.status === 400 && (!needle || JSON.stringify(x.json.details || []).includes(needle)), label);
    };
    await bad({ evidence_register: [{ ref: 'x', name: 'y', type: 'log', sha256: 'zz', source: '', acquired_at: '', notes: '', url: '' }] }, 'invalid SHA-256 is rejected with a clear message', 'SHA-256');
    await bad({ mitre_mapping: [{ technique: 'XSS', tactic: '', observation: '', detection_ref: '' }] }, 'invalid ATT&CK technique is rejected', 'T1059');
    await bad({ evidence_register: [{ ref: 'x', name: 'y', type: 'log', sha256: '', source: '', acquired_at: '', notes: '', url: 'javascript:alert(1)' }] }, 'javascript: evidence link is rejected', 'https');
    await bad({ detections: [{ ...inv.detections[0], attack: 'T1547.001, nonsense' }] }, 'bad technique inside a detection rule is rejected', 'NONSENSE');
    const many = Array.from({ length: 60 }, (_, i) => ({ host: 'h' + i, role: '', os_tools: '', notes: '' }));
    r = await api('/admin/api/collection/investigations', { method: 'POST', body: { ...inv, id: 'case-cap', visibility: 'private', lab_components: many } });
    r = await api('/admin/api/collection/investigations/case-cap');
    check(r.json.item.lab_components.length === 30, 'row count is capped (30 lab components)');

    // public exposure
    let js = await (await fetch(base + '/content.js')).text();
    check(js.includes('Run key persistence') && js.includes('EV-001') && js.includes('USECASE_TEXT'), 'public content.js carries the v2 sections of a public investigation');
    await api('/admin/api/collection/investigations/case-v2', { method: 'PUT', body: { ...saved, visibility: 'private' } });
    js = await (await fetch(base + '/content.js')).text();
    check(!js.includes('Run key persistence') && !js.includes('EV-001'), 'switching to private removes every v2 section from content.js');

    // challenge + moderation + names
    const ch = { id: 'c-mod', status: 'published', availability: 'open', title: { ar: 'ت', en: 'C' }, excerpt: { ar: 'م', en: 'b' }, category: { ar: '', en: 'DFIR' }, difficulty: { ar: '', en: 'Easy' }, date: '2026-11-25', tags: [],
      sections: [{ type: 'paragraph', zone: 'main', ar: 'ن', en: 'text', published: true }, { type: 'paragraph', zone: 'solution', ar: 'ح', en: 'SOLUTION_SENTINEL', published: true }], hints: [], artifacts: [], chips: [] };
    await api('/admin/api/challenges', { method: 'POST', body: ch });
    await api('/admin/api/challenges/c-mod/flag', { method: 'PUT', body: { flag: 'TOR{mod-1}' } });
    const ident = 'd'.repeat(32);
    const sub = (body) => fetch(base + '/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json());
    const evil = '\u202eevil\u200b name  https://spam.example/x  \u0000ok';
    const s1 = await sub({ identity: ident, challenge: 'c-mod', flag: 'TOR{mod-1}', name: evil });
    check(s1.status === 'correct' && s1.name === 'evil name ok', 'names are sanitised (bidi/zero-width/control chars and URLs removed)');
    let list = await (await fetch(base + '/api/solvers?challenge=c-mod')).json();
    check(list.solvers.length === 1 && list.solvers[0].name === 'evil name ok', 'solver list shows the sanitised name');
    await api('/admin/api/players/' + ident + '/disabled', { method: 'POST', body: { disabled: true } });
    list = await (await fetch(base + '/api/solvers?challenge=c-mod')).json();
    check(list.solvers.length === 0, 'a disabled player disappears from the public solver list');
    const all = await (await fetch(base + '/api/solvers')).json();
    check(JSON.stringify(all).indexOf('evil name ok') === -1, 'a disabled player is hidden from the all-challenges list too');
    js = await (await fetch(base + '/content.js')).text();
    check(js.includes('SOLUTION_SENTINEL'), 'local run (no production env): solution stays in content.js as before');
  } finally { proc.kill(); }

  // production-like env: solutions withheld by default
  const port2 = port + 1;
  const env2 = { ...env, TOR_PORT: String(port2), NODE_ENV: 'production' }; delete env2.TOR_GATE_SOLUTIONS;
  const dataDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-inv2-data2-'));
  fs.copyFileSync(path.join(dataDir, 'store.json'), path.join(dataDir2, 'store.json')); fs.copyFileSync(flagsFile, path.join(dataDir2, 'flags.json'));
  env2.TOR_DATA_DIR = dataDir2; env2.TOR_FLAGS_FILE = path.join(dataDir2, 'flags.json');
  const proc2 = spawn(process.execPath, [path.join(root, 'server', 'server.js')], { cwd: root, env: env2, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('server2 timeout')), 8000); proc2.stdout.on('data', d => { if (String(d).includes('http://')) { clearTimeout(t); res(); } }); });
  try {
    const js2 = await (await fetch('http://127.0.0.1:' + port2 + '/content.js')).text();
    check(!js2.includes('SOLUTION_SENTINEL'), 'production env: challenge solutions are withheld from the public script by default');
  } finally { proc2.kill(); }

  console.log('TOTAL ' + passed + ' investigation-v2 assertions passed');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
