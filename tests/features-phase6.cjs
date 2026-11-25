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

    // 6.1 Removed bloat: scoreboard & search return 404
    for (const dead of ['/api/scoreboard', '/scoreboard-en.html', '/scoreboard-ar.html', '/search-en.html', '/search-ar.html']) {
      const dr = await fetch(base + dead, { redirect: 'manual' });
      check(dr.status === 404, `removed ${dead} returns 404`);
    }

    // 6.2 Two-step flag verification -> write name -> recorded with timestamp (no points)
    const id1 = '11111111111111111111111111111111';
    const id2 = '22222222222222222222222222222222';
    const flag1 = 'TOR{198.51.100.44}';

    const claimBefore = await fetch(base + '/api/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id1, name: 'Cheater', challenge: 'log4shell-lab' })
    });
    check(claimBefore.status === 403, 'cannot claim solve name without verifying flag first');

    const step1 = await (await fetch(base + '/api/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id1, challenge: 'log4shell-lab', flag: flag1 })
    })).json();
    check(step1.status === 'verified' && !!step1.ts, 'step 1 verifies flag and issues pending timestamp');

    const stPending = await (await fetch(base + '/api/state?identity=' + id1)).json();
    check(Array.isArray(stPending.pending) && stPending.pending.includes('log4shell-lab') && !stPending.solved.includes('log4shell-lab'), '/api/state reflects pending name claim');

    const step2 = await (await fetch(base + '/api/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id1, name: 'Alice', challenge: 'log4shell-lab' })
    })).json();
    check(step2.status === 'correct' && step2.name === 'Alice' && !!step2.ts && step2.points === undefined, 'step 2 records solver name + timestamp with no points');

    await fetch(base + '/api/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: id2, name: 'Bob', challenge: 'log4shell-lab', flag: flag1 })
    });
    const sv = await (await fetch(base + '/api/solvers?challenge=log4shell-lab')).json();
    check(Array.isArray(sv.solvers) && sv.solvers.length === 2 && sv.solvers[0].name === 'Alice' && !!sv.solvers[0].ts && sv.solvers[1].name === 'Bob', '/api/solvers returns solvers with timestamps in chronological order');
    check(!JSON.stringify(sv).includes(id1) && !JSON.stringify(sv).includes(id2), 'solvers API never leaks identity tokens');

    // 6.3 Inline Markdown parser safety (DOM-only, no innerHTML, literal <img onerror>)
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

    // 6.4 MITRE ATT&CK + Writeup type validation
    const val = require('../server/validators');
    const atkRes = val.validateCollections({
      articles: [{ id: 'atk-1', writeup_type: 'walkthrough', related_challenge: 'log4shell-lab', title: { ar: 'ع', en: 'E' }, excerpt: { ar: '', en: '' }, slug: { ar: 'ع', en: 'e' }, attack: ['T1059.001', 'INVALID', 'T1190'], sections: [] }],
      challenges: []
    });
    check(atkRes.ok && JSON.stringify(atkRes.value.articles[0].attack) === JSON.stringify(['T1059.001', 'T1190']), 'ATT&CK validator keeps valid techniques and drops invalid ones');
    check(atkRes.value.articles[0].writeup_type === 'walkthrough' && atkRes.value.articles[0].related_challenge === 'log4shell-lab', 'writeup type & related challenge persist cleanly');

    // 6.5 Scheduled publication with mocked clock
    const vis = require('../server/visibility');
    const schedCols = {
      articles: [{ id: 'sched-1', status: 'published', publish_at: '2030-01-01T00:00:00Z', title: { en: 'Future' } }],
      challenges: [], investigations: []
    };
    check(vis.publicCollections(schedCols, Date.parse('2029-12-31T23:59:59Z')).articles.length === 0, 'scheduled item hidden before publish_at');
    check(vis.publicCollections(schedCols, Date.parse('2030-01-01T00:00:01Z')).articles.length === 1, 'scheduled item visible after publish_at');

    // 6.6 End-to-end Investigation (Use Case, Detection Engineering, Detection Rule) via Admin API -> public content
    await fetch(base + '/admin/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'qa-admin', password: 'qa-local-pass-1234' }) });
    const lRes = await fetch(base + '/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'qa-admin', password: 'qa-local-pass-1234' }) });
    const cookie = lRes.headers.get('set-cookie').split(';')[0];
    const csrf = (await lRes.json()).csrf;
    const invCreate = await fetch(base + '/admin/api/collection/investigations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({
        id: 'case-rule-1',
        title: { ar: 'تحقيق اختباري', en: 'Test Investigation' },
        slug: { ar: 'تحقيق-1', en: 'case-rule-slug' },
        summary: { ar: 'ملخص', en: 'Summary' },
        status: 'closed',
        visibility: 'public',
        attack: ['T1003.001', 'BAD'],
        publish_at: '2026-01-01T00:00:00Z',
        use_case: { ar: 'حالة الاستخدام', en: 'Detect suspicious LSASS access' },
        detection_engineering: { ar: 'هندسة الكشف', en: 'Monitor Sysmon Event ID 10 with GrantedAccess 0x1010' },
        detection_rule_lang: 'Sigma',
        detection_rule: 'title: LSASS Memory Read\nstatus: experimental\ndetection:\n  selection:\n    EventID: 10',
        seo_title: { ar: '', en: 'LSASS SEO Title' }
      })
    });
    check(invCreate.status === 200, 'admin creates investigation with Use Case, Detection Engineering, Detection Rule, slug, and SEO');
    // Partial update preserves slug/seo_title, rejects invalid URL or missing EN title in EN-only mode
    const invUpd = await fetch(base + '/admin/api/collection/investigations/case-rule-1', {
      method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ title: { en: 'Test Investigation Updated' }, summary: { en: 'Summary' }, status: 'closed', visibility: 'public', use_case: { en: 'Detect suspicious LSASS access' }, detection_engineering: { en: 'Monitor Sysmon Event ID 10 with GrantedAccess 0x1010' }, detection_rule_lang: 'Sigma', detection_rule: 'title: LSASS Memory Read' })
    });
    const invGot = await (await fetch(base + '/admin/api/collection/investigations/case-rule-1', { headers: { cookie } })).json();
    check(invUpd.status === 200 && invGot.item.slug && invGot.item.slug.en === 'case-rule-slug' && invGot.item.seo_title.en === 'LSASS SEO Title' && JSON.stringify(invGot.item.attack) === JSON.stringify(['T1003.001']), 'partial investigation PUT preserves slug, seo_title, and filters attack IDs');
    const invBadUrl = await fetch(base + '/admin/api/collection/investigations', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ id: 'bad-inv-1', title: { en: 'Bad' }, evidence: [{ label: 'x', url: 'https://nodot' }] })
    });
    check(invBadUrl.status === 400, 'investigation rejects URLs missing valid host dot');
    const invNoEn = await fetch(base + '/admin/api/collection/investigations', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ id: 'bad-inv-2', title: { ar: 'عربي فقط', en: '' } })
    });
    check(invNoEn.status === 400, 'investigation requires title.en when arabic_enabled=false');

    // Permanent DELETE /admin/api/challenges/:id removes challenge and flag
    const mkCh = await fetch(base + '/admin/api/challenges', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ id: 'del-test-ch', status: 'draft', title: { ar: '', en: 'To Delete' }, excerpt: { ar: '', en: '' }, slug: { ar: '', en: 'del-test-ch' }, sections: [] })
    });
    check(mkCh.status === 200, 'created temp challenge for delete test');
    await fetch(base + '/admin/api/challenges/del-test-ch/flag', { method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf }, body: JSON.stringify({ flag: 'TOR{tmp}' }) });
    const delRes = await fetch(base + '/admin/api/challenges/del-test-ch', { method: 'DELETE', headers: { cookie, 'x-csrf-token': csrf } });
    const afterDelGet = await fetch(base + '/admin/api/challenges/del-test-ch', { headers: { cookie } });
    const afterDelFlag = await (await fetch(base + '/admin/api/challenges/del-test-ch/flag', { headers: { cookie } })).json();
    check(delRes.status === 200 && afterDelGet.status === 404 && !afterDelFlag.configured, 'DELETE /admin/api/challenges/:id permanently removes challenge and flag');

    // Oversized body returns 413 cleanly without hanging
    const bigRes = await fetch(base + '/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: id1, challenge: 'log4shell-lab', flag: 'A'.repeat(6000) }) });
    check(bigRes.status === 413, 'oversized /api/submit returns 413 cleanly');
    for (const deadAdm of ['/admin/kb.html', '/admin/projects.html', '/admin/api/collection/kb', '/admin/api/collection/projects']) {
      const ar = await fetch(base + deadAdm, { headers: { cookie }, redirect: 'manual' });
      check(ar.status === 404, `removed ${deadAdm} returns 404`);
    }
    const cjsInv = await (await fetch(base + '/content.js')).text();
    check(cjsInv.includes('Detect suspicious LSASS access') && cjsInv.includes('Monitor Sysmon Event ID 10') && cjsInv.includes('LSASS Memory Read') && cjsInv.includes('"detection_rule_lang":"Sigma"'), '/content.js exposes Use Case, Detection Engineering, and Detection Rule for public investigations');

    // 6.7 Gated solutions (TOR_GATE_SOLUTIONS=1)
    const portGate = 19452;
    const baseGate = 'http://127.0.0.1:' + portGate;
    const childGate = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, TOR_PORT: String(portGate), TOR_SHOW_SAMPLES: '1', TOR_GATE_SOLUTIONS: '1' }, stdio: 'ignore' });
    try {
      for (let i = 0; i < 50; i++) { try { if ((await fetch(baseGate + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
      const cjsGate = await (await fetch(baseGate + '/content.js')).text();
      check(!cjsGate.includes('"zone":"solution"'), 'TOR_GATE_SOLUTIONS=1 strips solution blocks from /content.js');
      const unsolId = '33333333333333333333333333333333';
      const r403 = await fetch(baseGate + '/api/solution?challenge=log4shell-lab&identity=' + unsolId);
      check(r403.status === 403, '/api/solution returns 403 for unsolved identity');
      const r200 = await fetch(baseGate + '/api/solution?challenge=log4shell-lab&identity=' + id1);
      const j200 = await r200.json();
      check(r200.status === 200 && Array.isArray(j200.sections) && j200.sections.length > 0, '/api/solution returns 200 + sections for solved identity');
    } finally {
      childGate.kill();
    }

    // 6.8 About & CV + CSS/Meta consistency checks
    const aboutEn = await (await fetch(base + '/about-en.html')).text();
    check(aboutEn.includes('assets/Mina-Maximous-CV.pdf') && aboutEn.includes('Technical Skills') && aboutEn.includes('Experience') && aboutEn.includes('Education'), 'about-en.html includes full CV sections and PDF link');
    const cssTxt = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    check(cssTxt.includes('code.inline-code') && cssTxt.includes('.papyrus-reader a') && cssTxt.includes('.papyrus-reader blockquote'), 'style.css styles inline-code, links, and blockquotes in papyrus-reader');
    const artEnHtml = fs.readFileSync(path.join(root, 'articles-en.html'), 'utf8');
    check(!artEnHtml.includes('twitter:title" content="Articles'), 'articles-en.html twitter meta updated to Writeups');

    console.log('TOTAL ' + count + ' phase-6 assertions passed');
  } finally {
    child.kill();
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
