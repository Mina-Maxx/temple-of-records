// The Temple of Records — interactions + content rendering + CTF flag service client
// All content rendering is local: content.js defaults + this browser's localStorage overrides.
// Flag verification and solve records live ONLY on the lightweight local server (server/server.js);
// no expected flag or hash ever appears in client files.

// ---------- shared content library ----------
window.TOR = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fieldOverrides() {
    try { return JSON.parse(localStorage.getItem('tor-content') || '{}'); } catch (e) { return {}; }
  }
  function getCollections() {
    if (/^https?:$/.test(location.protocol)) return SITE_COLLECTIONS;
    try {
      var raw = localStorage.getItem('tor-collections');
      if (raw) {
        var c = JSON.parse(raw);
        if (c && Array.isArray(c.articles) && Array.isArray(c.challenges)) return c;
      }
    } catch (e) {}
    return SITE_COLLECTIONS;
  }
  function find(kind, id) {
    var list = getCollections()[kind] || [];
    for (var i = 0; i < list.length; i++) if ((list[i].id === id || list[i].slug && (list[i].slug.ar===id || list[i].slug.en===id)) && !list[i].hidden) return list[i];
    return null;
  }
  function visible(kind) {
    return (getCollections()[kind] || []).filter(function (x) { return !x.hidden; });
  }
  function setImgSrc(im, src) {
    if (!im || !src) return;
    im.src = src;
    if (im.parentNode && im.parentNode.tagName === 'PICTURE') {
      im.parentNode.querySelectorAll('source').forEach(function (s) { s.remove(); });
    }
  }
  function imgOk(src) {
    return typeof src === 'string' &&
      (/^assets\/[A-Za-z0-9._-]+$/.test(src) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src));
  }
  function urlOk(u) { return typeof u === 'string' && /^https:\/\/.+\..+/.test(u); }
  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  // anonymous player identity: random 128-bit token, this browser only
  function identity() {
    var id = localStorage.getItem('tor-identity');
    if (!id || !/^[a-f0-9]{32}$/.test(id)) {
      var b = new Uint8Array(16);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.floor(Math.random() * 256); });
      id = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem('tor-identity', id); } catch (e) {}
    }
    return id;
  }
  function apiBase() {
    if (/^https?:$/.test(location.protocol)) return location.origin;
    return 'http://127.0.0.1:8000'; // file:// preview talks to the local demo server
  }
  function localSolves() {
    try { return JSON.parse(localStorage.getItem('tor-solves') || '[]'); } catch (e) { return []; }
  }
  function markLocalSolve(id) {
    var s = localSolves();
    if (s.indexOf(id) === -1) { s.push(id); try { localStorage.setItem('tor-solves', JSON.stringify(s)); } catch (e) {} }
  }
  return { esc: esc, fieldOverrides: fieldOverrides, getCollections: getCollections,
           find: find, visible: visible, imgOk: imgOk, urlOk: urlOk, param: param,
           identity: identity, apiBase: apiBase, localSolves: localSolves, markLocalSolve: markLocalSolve,
           setImgSrc: setImgSrc };
})();

// ---------- collection renderers ----------
(function () {
  var body = document.body;
  if (!body) return;
  var page = body.getAttribute('data-page') || '';
  var arabicOff = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.arabic === false);
  var lang = arabicOff ? 'en' : (/-ar$/.test(page) ? 'ar' : 'en');
  var L = function (obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (arabicOff) return obj.en || '';
    return obj[lang] || obj.ar || obj.en || '';
  };
  var copyLabel = lang === 'ar' ? 'نسخ' : 'Copy';
  var copiedLabel = lang === 'ar' ? 'اتنسخ ✓' : 'Copied ✓';
  var T = {
    challenge: lang === 'ar' ? 'تحدي' : 'Challenge',
    article: lang === 'ar' ? 'مقال' : 'Article',
    category: lang === 'ar' ? 'التصنيف' : 'Category',
    difficulty: lang === 'ar' ? 'الصعوبة' : 'Difficulty',
    points: lang === 'ar' ? 'النقاط' : 'Points',
    time: lang === 'ar' ? 'الوقت المقدّر' : 'Est. time',
    availability: lang === 'ar' ? 'الحالة' : 'Status',
    open: lang === 'ar' ? 'متاح' : 'Available',
    soon: lang === 'ar' ? 'قريبًا' : 'Coming soon',
    evidence: lang === 'ar' ? 'الأدلة' : 'Evidence',
    files: lang === 'ar' ? 'ملفات' : 'files',
    solved: lang === 'ar' ? 'محلول ✓' : 'Solved ✓',
    unsolved: lang === 'ar' ? 'غير محلول' : 'Unsolved',
    noDate: ''
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function toArDigits(s) { return String(s).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; }); }
  function num(s) { return lang === 'ar' ? toArDigits(s) : String(s); }

  function renderInlineMd(parent, text) {
    var s = String(text == null ? '' : text);
    var re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;
    var last = 0, m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      var tok = m[0];
      if (tok.slice(0, 2) === '**') {
        var b = document.createElement('strong'); b.textContent = tok.slice(2, -2); parent.appendChild(b);
      } else if (tok.charAt(0) === '*') {
        var em = document.createElement('em'); em.textContent = tok.slice(1, -1); parent.appendChild(em);
      } else if (tok.charAt(0) === '`') {
        var cd = document.createElement('code'); cd.className = 'inline-code'; cd.textContent = tok.slice(1, -1); parent.appendChild(cd);
      } else if (tok.charAt(0) === '[') {
        var mid = tok.indexOf('](');
        var label = tok.slice(1, mid), href = tok.slice(mid + 2, -1);
        if (TOR.urlOk(href)) {
          var a = document.createElement('a'); a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
          parent.appendChild(a);
        } else {
          parent.appendChild(document.createTextNode(tok));
        }
      }
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
    return parent;
  }

  function renderSection(sec, idx, counter) {
    var t = sec.type, node;
    if (t === 'heading') {
      node = el('h2', null, L(sec));
      node.id = 'sec-' + idx;
      counter.headings.push({ id: node.id, text: L(sec) });
      return node;
    }
    if (t === 'paragraph') return renderInlineMd(el('p'), L(sec));
    if(t==='inline_code')return el('code', 'inline-code', L(sec));
    if(t==='link'){if(!TOR.urlOk(sec.url))return null;node=el('p');var a=el('a',null,L(sec)||sec.url);a.href=sec.url;a.target='_blank';a.rel='noopener noreferrer';node.appendChild(a);return node;}
    if (t === 'quote') return renderInlineMd(el('blockquote'), L(sec));
    if (t === 'table') {
      node=el('div','artifacts-wrap'); var tab=el('table','artifacts');
      var hr=el('tr');(sec.headers||[]).forEach(function(x){hr.appendChild(el('th',null,L(x)))});tab.appendChild(hr);
      (sec.rows||[]).forEach(function(row){var tr=el('tr');row.forEach(function(x){tr.appendChild(el('td',null,L(x)))});tab.appendChild(tr)});node.appendChild(tab);return node;
    }
    if (t === 'chips') return el('span', 'chips-inline', L(sec));
    if (t === 'callout') {
      node = el('div', 'callout');
      node.appendChild(el('span', 'callout-title', lang === 'ar' ? sec.title_ar : sec.title_en));
      renderInlineMd(node, L(sec));
      return node;
    }
    if (t === 'code') {
      node = el('div', 'codeblock');
      var head = el('div', 'cb-head');
      head.appendChild(el('span', null, lang === 'ar' ? sec.label_ar : sec.label_en));
      var preId = 'code-' + idx;
      var btn = el('button', 'copy-btn', copyLabel);
      btn.type = 'button';
      btn.setAttribute('data-target', preId);
      btn.setAttribute('data-copied-label', copiedLabel);
      head.appendChild(btn);
      node.appendChild(head);
      var pre = el('pre'); pre.id = preId; pre.textContent = sec.code || '';
      node.appendChild(pre);
      return node;
    }
    if (t === 'list') {
      node = el(sec.ordered ? 'ol' : 'ul');
      (sec.items || []).forEach(function (it) { node.appendChild(renderInlineMd(el('li'), L(it))); });
      return node;
    }
    if (t === 'timeline') {
      node = el('div', 'timeline');
      (sec.rows || []).forEach(function (r) {
        var row = el('div', 'tl-row');
        row.appendChild(el('span', 'tl-t', r.t || ''));
        row.appendChild(el('span', 'tl-x', L(r)));
        node.appendChild(row);
      });
      return node;
    }
    if (t === 'image') {
      node = el('figure', 'fig');
      if (TOR.imgOk(sec.src)) {
        var img = el('img');
        img.src = sec.src;
        img.alt = lang === 'ar' ? (sec.alt_ar || '') : (sec.alt_en || '');
        img.loading = 'lazy';
        node.appendChild(img);
      }
      var cap = lang === 'ar' ? sec.caption_ar : sec.caption_en;
      if (cap) node.appendChild(el('figcaption', null, cap));
      return node;
    }
    return null;
  }

  function buildToc(container, entries) {
    if (!container) return;
    var title = container.querySelector('.toc-title');
    var meta = container.querySelector('.toc-meta');
    container.innerHTML = '';
    if (title) container.appendChild(title);
    entries.forEach(function (x, i) {
      var n = String(i + 1).padStart(2, '0');
      if (lang === 'ar') n = toArDigits(n);
      var a = el('a', null, n + ' · ' + x.text);
      a.href = '#' + x.id;
      container.appendChild(a);
    });
    if (meta) container.appendChild(meta);
  }

  var PLACEHOLDER_MARKERS = ['to be added', 'تُضاف لاحقًا', 'يُضاف لاحقًا', 'تُضافان لاحقًا', 'يُضافان لاحقًا', 'placeholder', 'fabricated', 'أماكن مؤقتة'];
  function isPlaceholder(str) {
    if (typeof str !== 'string' || !str.trim()) return false;
    var low = str.toLowerCase();
    for (var i = 0; i < PLACEHOLDER_MARKERS.length; i++) {
      if (low.indexOf(PLACEHOLDER_MARKERS[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  function fillChips(box, chips, isSample, attack) {
    if (!box) return;
    box.innerHTML = '';
    (chips || []).forEach(function (c) {
      var txt = L(c);
      if (!isSample && /playable demo|fabricated|platform test|تجريبي|مُلفّقة|لاختبار المنصة/i.test(txt)) return;
      box.appendChild(el('span', 'chip' + (c.gold ? ' gold' : ''), txt));
    });
    (attack || []).forEach(function (id) {
      if (!/^T\d{4}(\.\d{3})?$/.test(id)) return;
      var a = el('a', 'chip gold', 'ATT&CK ' + id);
      a.href = 'https://attack.mitre.org/techniques/' + id.replace('.', '/') + '/';
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      box.appendChild(a);
    });
  }
  function metaJoin(parts, fallback) {
    var clean = parts.filter(function (x) { return x && String(x).trim(); });
    return clean.length ? clean.join(' · ') : fallback;
  }
  // append a meta line only when it has content (no more "to be added" filler on the public site)
  function addMeta(box, cls, parts, fallback) {
    var m = metaJoin(parts, fallback || '');
    if (m) box.appendChild(el('div', cls, m));
  }
  function solveBadge(id, withUnsolved) {
    var b = el('span', 'solve-badge', '');
    b.setAttribute('data-solve-badge', id);
    b.textContent = withUnsolved ? T.unsolved : '';
    if (!withUnsolved) b.hidden = true;
    return b;
  }

  function formatSolveTime(ts, lang) {
    if (!ts) return { relative: '', full: '', date: '', time: '' };
    var d = new Date(ts);
    if (isNaN(d.getTime())) return { relative: '', full: '', date: '', time: '' };
    var now = new Date();
    var diffMs = now - d;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHours = Math.floor(diffMin / 60);
    var diffDays = Math.floor(diffHours / 24);

    var isAr = lang === 'ar';
    var timeStr = d.toLocaleTimeString(isAr ? 'ar-EG-u-nu-latn' : 'en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    var dateStr = d.toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', {
      day: 'numeric', month: 'short'
    });

    var relStr = '';
    if (diffSec < 60) {
      relStr = isAr ? 'الآن' : 'just now';
    } else if (diffMin < 60) {
      relStr = isAr ? ('منذ ' + diffMin + ' دقيقة') : (diffMin + 'm ago');
    } else if (diffHours < 24 && d.getDate() === now.getDate()) {
      relStr = isAr ? ('اليوم · ' + timeStr) : ('Today · ' + timeStr);
    } else if (diffDays === 1) {
      relStr = isAr ? ('أمس · ' + timeStr) : ('Yesterday · ' + timeStr);
    } else {
      relStr = dateStr + ' · ' + timeStr;
    }

    var fullStr = d.toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    }) + ' ' + timeStr;

    return {
      relative: relStr,
      full: fullStr,
      date: dateStr,
      time: timeStr
    };
  }

  function renderChallengeCardSolvers(box, list, cid) {
    if (!box) return;
    box.innerHTML = '';
    var isAr = lang === 'ar';
    var href = (isAr ? 'challenge-ar.html' : 'challenge-en.html') + '?c=' + encodeURIComponent(cid);

    if (!list || !list.length) {
      box.innerHTML = '<div class="rec-solvers-empty"><span class="no-solvers-icon">⚔️</span><span>' +
        (isAr ? 'لم يحلّه أحد بعد — كن صاحب أول حل (First Blood)! 🩸' : 'No solvers yet — claim First Blood! 🩸') +
        '</span></div>';
      return;
    }

    var hdr = el('div', 'rec-solvers-header');
    hdr.appendChild(el('span', 'solver-trophy', '🏆'));
    var lbl = el('span', 'rec-solvers-label', (isAr ? 'أبطال الحل (' : 'Solvers (') + list.length + '):');
    hdr.appendChild(lbl);
    box.appendChild(hdr);

    var pillsBox = el('div', 'rec-solvers-list');
    var maxShow = 5;
    var showList = list.slice(0, maxShow);
    showList.forEach(function (s, idx) {
      var pill = el('span', 'solver-pill' + (idx === 0 ? ' first-blood' : ''));
      var rank = el('span', 'rank', idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1))));
      pill.appendChild(rank);
      var name = el('b', 'solver-name', s.name || (isAr ? 'مجهول' : 'Anonymous'));
      pill.appendChild(name);
      if (s.ts) {
        var tInfo = formatSolveTime(s.ts, lang);
        var timeSpan = el('span', 'solver-time', tInfo.relative);
        pill.appendChild(timeSpan);
        pill.title = (isAr ? 'تم الحل في: ' : 'Solved on: ') + tInfo.full;
      }
      pillsBox.appendChild(pill);
    });

    if (list.length > maxShow) {
      var more = el('a', 'solver-pill more', '+' + (list.length - maxShow) + (isAr ? ' آخرين' : ' more'));
      more.href = href;
      pillsBox.appendChild(more);
    }
    box.appendChild(pillsBox);
  }

  // ---------- CTF challenge card ----------
  function challengeCard(c) {
    var card = el('article', 'papyrus ctf');
    var ph = el('div', 'ph');
    ph.appendChild(el('span', 'cid', c.id));
    ph.appendChild(solveBadge(c.id, false));
    card.appendChild(ph);
    var h3 = el('h3');
    var link = el('a', null, L(c.title));
    link.href = (lang === 'ar' ? 'challenge-ar.html' : 'challenge-en.html') + '?c=' + encodeURIComponent(c.id);
    h3.appendChild(link); card.appendChild(h3);
    card.appendChild(el('p', null, L(c.excerpt)));
    var meta = el('div', 'ctf-meta');
    function row(k, v) { if (v == null || v === '') return; meta.appendChild(el('span', null, k + ': ' + v)); }
    row(T.category, L(c.category));
    row(T.difficulty, L(c.difficulty));
    row(T.points, c.points ? num(c.points) : '');
    row(T.time, L(c.est_time));
    row(T.availability, c.availability === 'open' ? T.open : T.soon);
    row(T.evidence, (c.artifacts || []).length ? num((c.artifacts || []).length) + ' ' + T.files : '');
    card.appendChild(meta);
    addMeta(card, 'foot', [c.date, (c.tags || []).join(' · ')], '');
    return card;
  }


  // ---------- wide record row (challenge list) ----------
  function challengeRow(c) {
    var card = el('article', 'tablet rec-row');
    card.setAttribute('data-avail', c.availability === 'open' ? 'open' : 'soon');
    var href = (lang === 'ar' ? 'challenge-ar.html' : 'challenge-en.html') + '?c=' + encodeURIComponent(c.id);
    if (TOR.imgOk(c.image)) {
      var a0 = el('a', 'scene-link'); a0.href = href;
      var im = el('img', 'scene'); im.src = c.image; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      a0.appendChild(im); card.appendChild(a0);
    }
    var body = el('div', 'body');
    var labels = el('div', 'labels');
    fillChips(labels, c.chips, !!c.sample);
    labels.appendChild(el('span', 'chip' + (c.availability === 'open' ? ' gold' : ''), c.availability === 'open' ? T.open : T.soon));
    labels.appendChild(solveBadge(c.id, true));
    body.appendChild(labels);
    var h3 = el('h3'); var link = el('a', null, L(c.title)); link.href = href;
    h3.appendChild(link); body.appendChild(h3);
    if (L(c.excerpt)) body.appendChild(el('p', 'rec-ex', L(c.excerpt)));
    addMeta(body, 'rec-meta', [L(c.category), L(c.difficulty), c.points ? num(c.points) + ' ' + (lang === 'ar' ? 'نقطة' : 'pts') : '', L(c.est_time),
      (c.artifacts || []).length ? num((c.artifacts || []).length) + ' ' + T.files : ''],
      '');

    var solversBox = el('div', 'rec-solvers');
    solversBox.setAttribute('data-solvers-challenge', c.id);
    solversBox.setAttribute('data-solvers-avail', c.availability);
    if (c.availability === 'open') {
      solversBox.innerHTML = '<div class="rec-solvers-header"><span class="solver-trophy">🏆</span><span class="rec-solvers-label">' +
        (lang === 'ar' ? 'أبطال الحل:' : 'Solvers:') +
        '</span></div><div class="rec-solvers-list"><span class="solver-pill skeleton-pulse" style="width:110px;height:24px;">&nbsp;</span><span class="solver-pill skeleton-pulse" style="width:80px;height:24px;">&nbsp;</span></div>';
    } else {
      solversBox.innerHTML = '<div class="rec-solvers-empty soon"><span>' + (lang === 'ar' ? 'قيد التجهيز ⏳' : 'In preparation ⏳') + '</span></div>';
    }
    body.appendChild(solversBox);

    card.appendChild(body);
    return card;
  }

  // intro line, filter bar and end-of-list note around a list
  function listChrome(box, kind, items) {
    var ar = lang === 'ar';
    var intro = el('p', 'list-intro', kind === 'challenges'
      ? (ar ? 'كل تحقيق يبدأ بأثر. تحديات مبنية على الملاحظة والأدلة والفهم.' : 'Every investigation begins with a trace. Challenges built for observation, evidence, and understanding.')
      : (ar ? 'مساحة للمقالات والملاحظات الميدانية.' : 'A home for articles and field notes.'));
    var bar = el('div', 'filter-bar');
    var mode = 'all';
    function btn(key, label) {
      var b = el('button', 'f-btn' + (key === 'all' ? ' on' : ''), label); b.type = 'button'; b.setAttribute('data-f', key);
      b.addEventListener('click', function () {
        mode = key;
        bar.querySelectorAll('.f-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
        box.querySelectorAll('.rec-row').forEach(function (r) { r.hidden = !(mode === 'all' || r.getAttribute('data-avail') === mode); });
      });
      bar.appendChild(b);
    }
    if (kind === 'challenges') {
      btn('all', ar ? 'كل التحديات' : 'All challenges');
      btn('open', ar ? 'متاح' : 'Available');
      btn('soon', ar ? 'قيد التحضير' : 'In preparation');
      bar.appendChild(el('span', 'f-note', ar ? 'التصنيف: التحليل الجنائي الرقمي' : 'Category: digital forensics'));
    } else {
      btn('all', ar ? 'كل المقالات' : 'All articles');
      bar.appendChild(el('span', 'f-note', (items && items.length) ? num(items.length) + ' ' + (ar ? 'مقال' : 'article(s)') : ''));
    }
    box.parentNode.insertBefore(intro, box);
    box.parentNode.insertBefore(bar, box);
    var end = el('div', 'list-end');
    end.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><ellipse cx="12" cy="13" rx="5" ry="6"/><path d="M12 7V4M9 4h6M7 10 3 8M7 14l-4 1M17 10l4-2M17 14l4 1M12 8v10"/></svg>';
    end.appendChild(el('p', null, kind === 'challenges'
      ? (ar ? 'ستجد سجلات أخرى مكانها هنا.' : 'More records will find their place here.')
      : (ar ? 'الأرشيف ينتظر سجله التالي.' : 'The archive awaits its next record.')));
    box.parentNode.appendChild(end);
  }

  function articleCard(a) {
    var card = el('article', 'papyrus');
    var ph = el('div', 'ph');
    ph.appendChild(el('span', null, T.article));
    card.appendChild(ph);
    var h3 = el('h3');
    var link = el('a', null, L(a.title));
    link.href = (lang === 'ar' ? 'article-ar.html' : 'article-en.html') + '?a=' + encodeURIComponent(a.id);
    h3.appendChild(link); card.appendChild(h3);
    card.appendChild(el('p', null, L(a.excerpt)));
    addMeta(card, 'foot', [a.date, (a.tags || []).join(' · ')], '');
    return card;
  }

  // ---------- article detail ----------
  if (page === 'article-ar' || page === 'article-en') {
    var item = (TOR.param('a') || TOR.param('id')) ? TOR.find('articles', TOR.param('a') || TOR.param('id')) : TOR.visible('articles')[0];
    var reader = document.getElementById('reader');
    if (!item) {
      if (reader) reader.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد مقالات بعد.' : 'No articles yet.'));
    } else {
      document.title = (L(item.seo_title||{})||L(item.title)) + (lang === 'ar' ? ' · مينا مكس' : ' · Mina Max');
      var md=L(item.meta_description||{});if(md){var mm=document.querySelector('meta[name=description]')||document.createElement('meta');mm.name='description';mm.content=md;document.head.appendChild(mm)}
      var cur = document.getElementById('crumb-cur'); if (cur) cur.textContent = L(item.title);
      var ban = document.querySelector('.pagehead .banner');
      if (ban && TOR.imgOk(item.image)) TOR.setImgSrc(ban, item.image);
      fillChips(document.getElementById('item-labels'), item.chips, !!item.sample, item.attack);
      var h1 = document.getElementById('item-title'); if (h1) h1.textContent = L(item.title);
      var meta = document.getElementById('item-meta');
      if (meta) meta.textContent = metaJoin([item.date, (item.tags || []).join(' · '), item.minutes],
        '');
      var counter = { headings: [] };
      (item.sections || []).forEach(function (sec, i) {
        var node = renderSection(sec, i, counter);
        if (node) reader.appendChild(node);
      });
      buildToc(document.getElementById('toc'), counter.headings);
    }
  }

  // ---------- challenge detail ----------
  var currentChallenge = null;
  if (page === 'challenge-ar' || page === 'challenge-en') {
    var ch = (TOR.param('c') || TOR.param('id')) ? TOR.find('challenges', TOR.param('c') || TOR.param('id')) : TOR.visible('challenges')[0];
    currentChallenge = ch;
    if (!ch) {
      var zm0 = document.getElementById('zone-main');
      if (zm0) zm0.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد تحديات بعد.' : 'No challenges yet.'));
      ['walkthrough-section','region-repo','region-artifacts','region-hints','region-flag'].forEach(function (id) {
        var x = document.getElementById(id); if (x) x.style.display = 'none';
      });
    } else {
      document.title = L(ch.title) + (lang === 'ar' ? ' · مينا مكس' : ' · Mina Max');
      var cur2 = document.getElementById('crumb-cur'); if (cur2) cur2.textContent = L(ch.title);
      var ban2 = document.querySelector('.pagehead .banner');
      if (ban2 && TOR.imgOk(ch.image)) TOR.setImgSrc(ban2, ch.image);
      fillChips(document.getElementById('item-labels'), ch.chips, !!ch.sample, ch.attack);
      var h1b = document.getElementById('item-title'); if (h1b) h1b.textContent = L(ch.title);
      var meta2 = document.getElementById('item-meta');
      if (meta2) meta2.textContent = metaJoin([L(ch.category), L(ch.difficulty),
        ch.points ? num(ch.points) + ' ' + (lang === 'ar' ? 'نقطة' : 'pts') : '', L(ch.est_time), ch.date],
        '');
      var counter2 = { headings: [] };
      var main = document.getElementById('zone-main');
      [['scenario','السيناريو','Scenario'],['objectives','أهداف التحقيق','Investigation objectives'],['required_skills','المهارات المطلوبة','Required skills'],['tools','الأدوات المطلوبة','Tools required'],['instructions','التعليمات','Instructions']].forEach(function(x){var text=L(ch[x[0]]||{});if(text&&main){var h=el('h2',null,lang==='ar'?x[1]:x[2]);h.id='brief-'+x[0];main.appendChild(h);main.appendChild(el('p',null,text));counter2.headings.push({id:h.id,text:h.textContent})}});
      var sol = document.getElementById('zone-solution');
      var firstSolHeading = null;
      (ch.sections || []).forEach(function (sec, i) {
        var node = renderSection(sec, i, counter2);
        if (!node) return;
        if (sec.zone === 'solution') {
          if (!firstSolHeading && sec.type === 'heading') { node.setAttribute('tabindex', '-1'); firstSolHeading = node; }
          if (sol) sol.appendChild(node);
        } else if (main) main.appendChild(node);
      });

      // --- evidence repository (repo link) ---
      var repoBox = document.getElementById('repo-body');
      if (repoBox) {
        if (ch.repo && TOR.urlOk(ch.repo.url)) {
          var ra = el('a', 'repo-link', (lang === 'ar' ? ch.repo.label_ar : ch.repo.label_en) || 'Repository');
          ra.href = ch.repo.url; ra.target = '_blank'; ra.rel = 'noopener noreferrer';
          repoBox.appendChild(ra);
        } else {
          var rrBox = document.getElementById('region-repo'); if (rrBox) rrBox.style.display = 'none';
        }
      }

      // --- artifacts table ---
      var artBox = document.getElementById('artifacts-body');
      if (artBox) {
        var arts = ch.artifacts || [];
        if (!arts.length) {
          var raBox = document.getElementById('region-artifacts'); if (raBox) raBox.style.display = 'none';
        } else {
          var tbl = el('table', 'artifacts');
          var trh = el('tr');
          [lang === 'ar' ? 'الملف' : 'File', lang === 'ar' ? 'النوع' : 'Type',
           lang === 'ar' ? 'الحجم' : 'Size', 'SHA-256', lang === 'ar' ? 'الوصف' : 'Description',
           lang === 'ar' ? 'التحميل' : 'Download'].forEach(function (h) { var th = el('th', null, h); th.setAttribute('scope', 'col'); trh.appendChild(th); });
          tbl.appendChild(trh);
          arts.forEach(function (a) {
            var tr = el('tr');
            tr.appendChild(el('td', 'mono', a.name || ''));
            tr.appendChild(el('td', 'mono', a.type || ''));
            tr.appendChild(el('td', 'mono', a.size || ''));
            var tdS = el('td', 'mono sha'); tdS.textContent = a.sha256 || ''; tdS.title = a.sha256 || ''; tr.appendChild(tdS);
            tr.appendChild(el('td', null, lang === 'ar' ? a.desc_ar : a.desc_en));
            var tdD = el('td', 'dl');
            if (a.status === 'unavailable' || a.status === 'planned') {
              tdD.appendChild(el('span', 'muted-note', a.status === 'planned' ? (lang === 'ar' ? 'مخطَّط، غير متاح بعد' : 'Planned, not available yet') : (lang === 'ar' ? 'غير متاح حاليًا' : 'Currently unavailable')));
            } else if (TOR.urlOk(a.url)) {
              var dl = el('a', 'btn-mini', lang === 'ar' ? 'تحميل' : 'Download');
              dl.href = a.url; dl.target = '_blank'; dl.rel = 'noopener noreferrer';
              tdD.appendChild(dl);
              if (TOR.urlOk(a.mirror)) {
                var mr = el('a', 'btn-mini ghost', lang === 'ar' ? 'مرآة' : 'Mirror');
                mr.href = a.mirror; mr.target = '_blank'; mr.rel = 'noopener noreferrer';
                tdD.appendChild(mr);
              }
            } else {
              tdD.appendChild(el('span', 'muted-note', '—'));
            }
            tr.appendChild(tdD);
            tbl.appendChild(tr);
          });
          var awrap = el('div', 'artifacts-wrap');
          awrap.appendChild(tbl);
          artBox.appendChild(awrap);
          artBox.appendChild(el('p', 'muted-note', lang === 'ar'
            ? 'الروابط خارجية يوفّرها صاحب التحدي (https فقط)، وبيانات الحجم والتكامل كما وردت منه. لا تُستضاف ملفات الأدلة على هذا الخادم.'
            : 'Links are external, supplied by the challenge author (https only); size and checksum metadata as provided. Evidence files are not hosted on this server.'));
        }
      }

      // --- hints ---
      var hintBox = document.getElementById('hints-body');
      if (hintBox) {
        var hints = ch.hints || [];
        if (!hints.length) {
          hintBox.appendChild(el('p', 'muted-note', lang === 'ar' ? 'لا تلميحات لهذا التحدي.' : 'No hints for this challenge.'));
        } else {
          hints.forEach(function (h, i) {
            var d = el('details', 'hint');
            var costTxt = (h.cost && Number(h.cost) > 0) ? ' (-' + num(h.cost) + ' ' + (lang === 'ar' ? 'نقطة' : 'pts') + ')' : '';
            d.appendChild(el('summary', null, (lang === 'ar' ? 'تلميح ' : 'Hint ') + num(i + 1) + costTxt));
            d.appendChild(el('p', null, L(h)));
            if (h.cost && Number(h.cost) > 0) {
              var recorded = false;
              d.addEventListener('toggle', function () {
                if (d.open && !recorded) {
                  recorded = true;
                  fetch(TOR.apiBase() + '/api/hint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ challenge: ch.id, index: i, identity: TOR.identity() })
                  }).catch(function () {});
                }
              });
            }
            hintBox.appendChild(d);
          });
        }
      }

      // --- flag form meta ---
      var fmt = document.getElementById('flag-format');
      if (fmt && ch.flag) fmt.textContent = lang === 'ar' ? ch.flag.format_ar : ch.flag.format_en;

      // --- TOC ---
      var tocEntries = counter2.headings.slice();
      if ((ch.artifacts || []).length) tocEntries.push({ id: 'region-artifacts', text: lang === 'ar' ? 'مستودع الأدلة' : 'Evidence repository' });
      tocEntries.push({ id: 'region-hints', text: lang === 'ar' ? 'التلميحات' : 'Hints' });
      tocEntries.push({ id: 'region-flag', text: lang === 'ar' ? 'تسليم الفلاج' : 'Flag submission' });
      tocEntries.push({ id: 'walkthrough-section', text: lang === 'ar' ? 'الحل' : 'Walkthrough' });
      buildToc(document.getElementById('toc'), tocEntries);
      var tocMeta = document.querySelector('#toc .toc-meta span:last-child');
      if (tocMeta) { if (L(ch.difficulty)) tocMeta.textContent = (lang === 'ar' ? 'الصعوبة: ' : 'Difficulty: ') + L(ch.difficulty); else tocMeta.style.display = 'none'; }
    }
  }

  // ---------- investigations (public case files; opt-in via visibility = public) ----------
  T.investigation = lang === 'ar' ? 'ملف تحقيق' : 'Case file';
  function invStatus(st) {
    if (st === 'open') return lang === 'ar' ? 'مفتوح' : 'Open';
    if (st === 'closed') return lang === 'ar' ? 'مغلق' : 'Closed';
    return '';
  }
  function invCard(it) {
    var card = el('article', 'papyrus');
    var ph = el('div', 'ph'); ph.appendChild(el('span', null, T.investigation)); card.appendChild(ph);
    var h3 = el('h3'); var link = el('a', null, L(it.title));
    link.href = (lang === 'ar' ? 'investigation-ar.html' : 'investigation-en.html') + '?id=' + encodeURIComponent(it.id);
    h3.appendChild(link); card.appendChild(h3);
    if (L(it.summary)) card.appendChild(el('p', null, L(it.summary)));
    addMeta(card, 'foot', [invStatus(it.status), it.date, (it.tags || []).join(' · ')], '');
    return card;
  }
  if (page === 'investigations-ar' || page === 'investigations-en') {
    var invBox = document.getElementById('listing');
    var invList = TOR.visible('investigations');
    if (invBox) {
      if (!invList.length) invBox.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد ملفات تحقيق منشورة بعد.' : 'No published case files yet.'));
      invList.forEach(function (it) { invBox.appendChild(invCard(it)); });
    }
  }
  if (page === 'investigation-ar' || page === 'investigation-en') {
    var inv = TOR.param('id') ? TOR.find('investigations', TOR.param('id')) : TOR.visible('investigations')[0];
    var invReader = document.getElementById('reader');
    if (!inv) {
      if (invReader) invReader.appendChild(el('p', 'notice', lang === 'ar' ? 'ملف التحقيق غير متاح.' : 'This case file is not available.'));
    } else {
      document.title = (L(inv.seo_title || {}) || L(inv.title)) + (lang === 'ar' ? ' · مينا مكس' : ' · Mina Max');
      var invDesc = L(inv.meta_description || {}) || L(inv.summary);
      if (invDesc) { var invMeta = document.querySelector('meta[name=description]') || document.createElement('meta'); invMeta.name = 'description'; invMeta.content = invDesc.slice(0, 300); document.head.appendChild(invMeta); }
      var invCur = document.getElementById('crumb-cur'); if (invCur) invCur.textContent = L(inv.title);
      var invH1 = document.getElementById('item-title'); if (invH1) invH1.textContent = L(inv.title);
      var invLabels = document.getElementById('item-labels');
      if (invLabels && invStatus(inv.status)) invLabels.appendChild(el('span', 'chip' + (inv.status === 'open' ? ' gold' : ''), invStatus(inv.status)));
      var invMetaLine = document.getElementById('item-meta');
      if (invMetaLine) invMetaLine.textContent = metaJoin([inv.date, (inv.tags || []).join(' · ')], '');
      var secs = [];
      function invText(arTitle, enTitle, val) {
        var t = L(val); if (!t || !t.trim()) return;
        secs.push({ type: 'heading', ar: arTitle, en: enTitle });
        t.split(/\n{2,}/).forEach(function (p) { p = p.trim(); if (p) secs.push({ type: 'paragraph', ar: p, en: p }); });
      }
      function invLinks(arTitle, enTitle, list) {
        var ok = (list || []).filter(function (x) { return x && TOR.urlOk(x.url); });
        if (!ok.length) return;
        secs.push({ type: 'heading', ar: arTitle, en: enTitle });
        ok.forEach(function (x) { secs.push({ type: 'link', ar: x.label || x.url, en: x.label || x.url, url: x.url }); });
      }
      invText('الملخص', 'Summary', inv.summary);
      var invRows = (inv.timeline || []).filter(function (e) { return e && (L(e) || e.ts); });
      if (invRows.length) {
        secs.push({ type: 'heading', ar: 'الخط الزمني', en: 'Timeline' });
        secs.push({ type: 'timeline', rows: invRows.map(function (e) { return { t: e.ts || '', ar: e.ar, en: e.en }; }) });
      }
      invText('النتائج', 'Findings', inv.findings);
      invText('السبب الجذري', 'Root cause', inv.root_cause);
      invText('التحليل', 'Analysis', inv.analysis);
      invText('الدروس المستفادة', 'Lessons learned', inv.lessons_learned);
      invLinks('روابط الأدلة', 'Evidence links', inv.evidence);
      invLinks('روابط ذات صلة', 'Related links', inv.links);
      var invCounter = { headings: [] };
      secs.forEach(function (sec, i) { var n = renderSection(sec, i, invCounter); if (n && invReader) invReader.appendChild(n); });
      buildToc(document.getElementById('toc'), invCounter.headings);
    }
  }
  // nav link appears only when at least one case file is public (never a dead/empty link)
  (function () {
    if (!TOR.visible('investigations').length) return;
    var href = lang === 'ar' ? 'investigations-ar.html' : 'investigations-en.html';
    var label = lang === 'ar' ? 'التحقيقات' : 'Investigations';
    document.querySelectorAll('header.site nav.main, footer.site nav').forEach(function (nav) {
      if (nav.querySelector('a[href="' + href + '"]')) return;
      var a = document.createElement('a'); a.href = href; a.textContent = label;
      var about = nav.querySelector('a[href^="about-"]');
      if (about) nav.insertBefore(a, about); else nav.appendChild(a);
    });
  })();

  // ---------- global search (client-side, Arabic-aware normalization) ----------
  function normSearch(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  }
  (function () {
    var srHref = lang === 'ar' ? 'search-ar.html' : 'search-en.html';
    var srLabel = lang === 'ar' ? 'بحث' : 'Search';
    document.querySelectorAll('header.site nav.main, footer.site nav').forEach(function (nav) {
      if (nav.querySelector('a[href="' + srHref + '"]')) return;
      var a = document.createElement('a'); a.href = srHref; a.textContent = srLabel;
      var about = nav.querySelector('a[href^="about-"]');
      if (about) nav.insertBefore(a, about); else nav.appendChild(a);
    });
    if (page !== 'search-ar' && page !== 'search-en') return;
    var form = document.getElementById('search-form');
    var inp = document.getElementById('search-q');
    var out = document.getElementById('search-results');
    if (!form || !inp || !out) return;
    function runSearch(q) {
      out.innerHTML = '';
      var nq = normSearch(q).trim();
      var groups = [
        { key: 'challenges', label: lang === 'ar' ? 'التحديات' : 'Challenges', page: lang === 'ar' ? 'challenge-ar.html?c=' : 'challenge-en.html?c=' },
        { key: 'articles', label: lang === 'ar' ? 'المقالات' : 'Articles', page: lang === 'ar' ? 'article-ar.html?a=' : 'article-en.html?a=' },
        { key: 'investigations', label: lang === 'ar' ? 'التحقيقات' : 'Investigations', page: lang === 'ar' ? 'investigation-ar.html?id=' : 'investigation-en.html?id=' }
      ];
      var total = 0;
      groups.forEach(function (g) {
        var items = TOR.visible(g.key).filter(function (it) {
          if (!nq) return true;
          var hay = normSearch([L(it.title), L(it.excerpt || it.summary), (it.tags || []).join(' '), (it.attack || []).join(' ')].join(' '));
          return hay.indexOf(nq) !== -1;
        });
        if (!items.length) return;
        total += items.length;
        var h2 = el('h2', null, g.label + ' (' + num(items.length) + ')');
        h2.style.margin = '18px 0 10px';
        out.appendChild(h2);
        var ul = el('div', 'rec-list');
        items.forEach(function (it) {
          var card = el('article', 'tablet rec-row');
          var body = el('div', 'body');
          var h3 = el('h3');
          var a = el('a', null, L(it.title) || it.id);
          a.href = g.page + encodeURIComponent(it.id);
          h3.appendChild(a); body.appendChild(h3);
          var ex = L(it.excerpt || it.summary);
          if (ex) body.appendChild(el('p', 'rec-ex', ex));
          card.appendChild(body);
          ul.appendChild(card);
        });
        out.appendChild(ul);
      });
      if (!total) out.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد نتائج مطابقة.' : 'No matching records found.'));
    }
    var qInit = TOR.param('q');
    if (qInit) inp.value = qInit;
    runSearch(inp.value);
    form.addEventListener('submit', function (e) { e.preventDefault(); runSearch(inp.value); });
    inp.addEventListener('input', function () { runSearch(inp.value); });
  })();

  // ---------- scoreboard link in nav/footer + scoreboard page ----------
  (function () {
    var sbHref = lang === 'ar' ? 'scoreboard-ar.html' : 'scoreboard-en.html';
    var sbLabel = lang === 'ar' ? 'المتصدرون' : 'Scoreboard';
    document.querySelectorAll('header.site nav.main, footer.site nav').forEach(function (nav) {
      if (nav.querySelector('a[href="' + sbHref + '"]')) return;
      var a = document.createElement('a'); a.href = sbHref; a.textContent = sbLabel;
      var about = nav.querySelector('a[href^="about-"]');
      if (about) nav.insertBefore(a, about); else nav.appendChild(a);
    });
    if (page !== 'scoreboard-ar' && page !== 'scoreboard-en') return;
    var box = document.getElementById('scoreboard-box');
    if (!box) return;
    box.innerHTML = '<p class="notice"><span class="spinner"></span> ' + (lang === 'ar' ? 'جاري تحميل الترتيب...' : 'Loading scoreboard...') + '</p>';
    fetch(TOR.apiBase() + '/api/scoreboard')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rows = (d && d.scoreboard) || [];
        box.innerHTML = '';
        if (!rows.length) {
          box.appendChild(el('p', 'notice', lang === 'ar' ? 'لم تُسجّل حلول بعد — كن أول متصدر!' : 'No solves recorded yet — be the first on the board!'));
          return;
        }
        var tbl = el('table', 'artifacts');
        var trh = el('tr');
        [lang === 'ar' ? 'الترتيب' : 'Rank', lang === 'ar' ? 'اللاعب' : 'Player', lang === 'ar' ? 'النقاط' : 'Points', lang === 'ar' ? 'المحلول' : 'Solved', 'First Blood', lang === 'ar' ? 'آخر حل' : 'Last solve'].forEach(function (h) {
          var th = el('th', null, h); th.setAttribute('scope', 'col'); trh.appendChild(th);
        });
        tbl.appendChild(trh);
        rows.forEach(function (r, idx) {
          var tr = el('tr');
          tr.appendChild(el('td', 'mono', idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : '#' + (idx + 1)));
          tr.appendChild(el('td', null, r.name || 'Anonymous'));
          tr.appendChild(el('td', 'mono', num(r.points)));
          tr.appendChild(el('td', 'mono', num(r.solved)));
          tr.appendChild(el('td', 'mono', r.firstBloods ? '🩸 ' + num(r.firstBloods) : '—'));
          var tf = formatSolveTime(r.lastSolve, lang);
          tr.appendChild(el('td', 'mono', tf.relative || '—'));
          tbl.appendChild(tr);
        });
        box.appendChild(tbl);
      })
      .catch(function () {
        box.innerHTML = '';
        box.appendChild(el('p', 'notice', lang === 'ar' ? 'تعذر تحميل لوحة المتصدرين.' : 'Could not load scoreboard.'));
      });
  })();

  // ---------- listings ----------
  if (page === 'articles-ar' || page === 'articles-en') {
    var box = document.getElementById('listing');
    var artsL = TOR.visible('articles');
    if (box) {
      if (!artsL.length) box.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد مقالات بعد — تُضاف من لوحة التحرير.' : 'No articles yet — add them from the editor.'));
      artsL.forEach(function (a) { box.appendChild(articleCard(a)); });
      listChrome(box, 'articles', artsL);
    }
  }
  if (page === 'challenges-ar' || page === 'challenges-en') {
    var box2 = document.getElementById('listing');
    var chsL = TOR.visible('challenges');
    if (box2) {
      box2.className = 'rec-list';
      if (!chsL.length) box2.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد تحديات بعد — تُضاف من لوحة التحرير.' : 'No challenges yet — add them from the editor.'));
      chsL.forEach(function (c) { box2.appendChild(challengeRow(c)); });
      listChrome(box2, 'challenges', chsL);

      fetch(TOR.apiBase() + '/api/solvers')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var allSolvers = (data && data.solvers) || {};
          document.querySelectorAll('[data-solvers-challenge]').forEach(function (box) {
            var cid = box.getAttribute('data-solvers-challenge');
            var avail = box.getAttribute('data-solvers-avail');
            if (avail !== 'open') return;
            var list = allSolvers[cid] || [];
            renderChallengeCardSolvers(box, list, cid);
          });
        })
        .catch(function () {
          document.querySelectorAll('[data-solvers-challenge]').forEach(function (box) {
            var avail = box.getAttribute('data-solvers-avail');
            if (avail === 'open') {
              renderChallengeCardSolvers(box, [], box.getAttribute('data-solvers-challenge'));
            }
          });
        });
    }
  }

  // ---------- index ----------
  if (page === 'index-ar' || page === 'index-en') {
    var fc = TOR.visible('challenges').find(function(c){return c.featured}) || TOR.visible('challenges')[0];
    var tab = document.getElementById('feat-challenge');
    if (tab) {
      if (!fc) { tab.style.display = 'none'; }
      else {
        var im = tab.querySelector('img.scene');
        if (im && TOR.imgOk(fc.image)) TOR.setImgSrc(im, fc.image);
        var a0 = tab.querySelector('a.scene-link');
        if (a0) a0.href = (lang === 'ar' ? 'challenge-ar.html' : 'challenge-en.html') + '?c=' + encodeURIComponent(fc.id);
        fillChips(tab.querySelector('.labels'), fc.chips, !!fc.sample);
        var th = tab.querySelector('[data-slot="title"]'); if (th) th.textContent = L(fc.title);
        var tm = tab.querySelector('[data-slot="meta"]');
        if (tm) tm.textContent = metaJoin([L(fc.difficulty), fc.points ? num(fc.points) + ' ' + (lang === 'ar' ? 'نقطة' : 'pts') : '', L(fc.est_time)],
          '');
        if (tm && !tm.textContent && tm.parentNode) tm.parentNode.style.display = 'none';
        var lb = tab.querySelector('.labels'); if (lb) lb.appendChild(solveBadge(fc.id, false));

        var tabBody = tab.querySelector('.body');
        if (tabBody && fc.availability === 'open') {
          var fSolvers = tab.querySelector('.feat-solvers');
          if (!fSolvers) {
            fSolvers = el('div', 'rec-solvers feat-solvers');
            tabBody.appendChild(fSolvers);
          }
          fSolvers.setAttribute('data-solvers-challenge', fc.id);
          fSolvers.setAttribute('data-solvers-avail', fc.availability);
          fetch(TOR.apiBase() + '/api/solvers?challenge=' + encodeURIComponent(fc.id))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { renderChallengeCardSolvers(fSolvers, d && d.solvers || [], fc.id); })
            .catch(function () {});
        }
      }
    }
    var box3 = document.getElementById('feat-articles');
    if (box3) {
      var fa = TOR.visible('articles').slice(0, 2);
    if (!fa.length) { var secArt = document.getElementById('articles'); if (secArt) secArt.style.display = 'none'; }
      if (!fa.length) box3.appendChild(el('p', 'notice', lang === 'ar' ? 'لا توجد مقالات بعد.' : 'No articles yet.'));
      fa.forEach(function (a) { box3.appendChild(articleCard(a)); });
    }
  }

  // ---------- solved-state sync (server truth, local cache fallback) ----------
  (function () {
    var badges = document.querySelectorAll('[data-solve-badge]');
    if (!badges.length) return;
    function paint(solvedSet, fromServer) {
      badges.forEach(function (b) {
        var id = b.getAttribute('data-solve-badge');
        var solved = solvedSet.indexOf(id) !== -1;
        b.hidden = false;
        b.textContent = solved ? T.solved : T.unsolved;
        b.classList.toggle('yes', solved);
      });
      var fs = document.getElementById('flag-status');
      var fbtn = document.getElementById('flag-submit');
      var finp = document.getElementById('flag-input');
      if (currentChallenge && solvedSet.indexOf(currentChallenge.id) !== -1) {
        var solEl = document.getElementById('zone-solution');
        if (solEl && !solEl.children.length) {
          fetch(TOR.apiBase() + '/api/solution?challenge=' + encodeURIComponent(currentChallenge.id) + '&identity=' + TOR.identity())
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
              if (d && Array.isArray(d.sections) && d.sections.length && !solEl.children.length) {
                var cTmp = { headings: [] };
                d.sections.forEach(function (sec, idx) {
                  var n = renderSection(sec, 'sol-' + idx, cTmp);
                  if (n) solEl.appendChild(n);
                });
              }
            }).catch(function () {});
        }
        if (fs) { fs.className = 'flag-status ok'; fs.textContent = lang === 'ar' ? 'هذا التحدي محلول بالفعل ✓' : 'Already solved ✓'; }
        if (fbtn) {
          fbtn.disabled = true;
          fbtn.textContent = lang === 'ar' ? 'تم الحل ✓' : 'Solved ✓';
          fbtn.style.opacity = '0.7';
          fbtn.style.cursor = 'default';
        }
        if (finp) {
          finp.disabled = true;
          finp.placeholder = lang === 'ar' ? 'تم حل التحدي بنجاح' : 'Challenge already solved';
        }
      }
    }
    // instant paint from local cache, then server truth
    paint(TOR.localSolves(), false);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 2500);
    fetch(TOR.apiBase() + '/api/state?identity=' + TOR.identity(), { signal: ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        clearTimeout(timer);
        if (d && Array.isArray(d.solved)) {
          paint(d.solved, true);
          try { localStorage.setItem('tor-solves', JSON.stringify(d.solved)); } catch (e) {}
        }
      })
      .catch(function () {
        clearTimeout(timer);
        var note = document.getElementById('flag-server-note');
        if (note) note.textContent = lang === 'ar'
          ? 'التحقق من الفلاج يحتاج تشغيل الخادم المحلي (server/server.js). الحالة المعروضة من هذا المتصفح فقط.'
          : 'Flag verification needs the local server (server/server.js) running. Status shown is from this browser only.';
      });
  })();

  // ---------- flag submission + solvers ----------
  (function () {
    var form = document.getElementById('flag-form');
    if (!form || !currentChallenge) return;
    var nameIn = document.getElementById('flag-name');
    var hideIn = document.getElementById('flag-hide-name');
    var input = document.getElementById('flag-input');
    var btn = document.getElementById('flag-submit');
    var status = document.getElementById('flag-status');
    var chId = currentChallenge.id;
    var solversSec = document.getElementById('solvers-section');
    var solversList = document.getElementById('solvers-list');

    if (nameIn) {
      var savedName = localStorage.getItem('tor-player-name') || '';
      if (savedName) nameIn.value = savedName;
    }

    function renderSolvers(solvers) {
      if (!solversSec || !solversList) return;
      var isAr = lang === 'ar';
      solversSec.hidden = false;
      solversList.innerHTML = '';

      var titleEl = solversSec.querySelector('.solvers-title');
      if (titleEl) {
        titleEl.innerHTML = '<span>🏆 ' +
          (isAr ? 'أبطال حلّوا هذا التحدي' : 'Champions of this Challenge') +
          '</span>' +
          (solvers && solvers.length ? '<span class="solvers-count-badge">' + solvers.length + (isAr ? ' حل صحيح' : ' solves') + '</span>' : '');
      }

      if (!solvers || !solvers.length) {
        solversList.innerHTML = '<div class="solvers-empty-box">' +
          '<div class="empty-icon">🩸⚔️</div>' +
          '<div class="empty-title">' + (isAr ? 'لم يُسجَّل أي حل صحيح بعد!' : 'No correct solutions recorded yet!') + '</div>' +
          '<div class="empty-desc">' + (isAr ? 'أرسل الفلاج الصحيح أعلاه لتخلّد اسمك كصاحب أول حل (First Blood) في معبد السجلات.' : 'Submit the correct flag above to etch your name as First Blood in the Temple Records.') + '</div>' +
          '</div>';
        return;
      }

      solvers.forEach(function (s, idx) {
        var badge = document.createElement('span');
        badge.className = 'solver-badge' + (idx === 0 ? ' first-blood' : '');

        var rankSpan = document.createElement('span');
        rankSpan.className = 'rank';
        rankSpan.textContent = idx === 0 ? '🥇 First Blood' : (idx === 1 ? '🥈 2nd' : (idx === 2 ? '🥉 3rd' : '#' + (idx + 1)));
        badge.appendChild(rankSpan);

        var nameSpan = document.createElement('b');
        nameSpan.className = 'solver-name';
        nameSpan.textContent = s.name || (isAr ? 'مجهول' : 'Anonymous');
        badge.appendChild(nameSpan);

        if (s.ts) {
          var tInfo = formatSolveTime(s.ts, lang);
          var timeSpan = document.createElement('span');
          timeSpan.className = 'ts';
          timeSpan.textContent = tInfo.relative;
          badge.appendChild(timeSpan);
          badge.title = (isAr ? 'تم الحل في: ' : 'Solved on: ') + tInfo.full;
        }
        solversList.appendChild(badge);
      });
    }

    function loadSolvers() {
      if (solversList && !solversList.children.length) {
        solversList.innerHTML = '<span class="solver-badge skeleton-pulse" style="width:140px;height:28px;">&nbsp;</span><span class="solver-badge skeleton-pulse" style="width:110px;height:28px;">&nbsp;</span>';
        if (solversSec) solversSec.hidden = false;
      }
      fetch(TOR.apiBase() + '/api/solvers?challenge=' + encodeURIComponent(chId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { renderSolvers(d && d.solvers); })
        .catch(function () { renderSolvers([]); });
    }
    loadSolvers();

    function set(cls, msg, isHtml) {
      status.className = 'flag-status ' + cls;
      if (isHtml) status.innerHTML = msg; else status.textContent = msg;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameVal = nameIn ? (nameIn.value || '').trim() : '';
      var val = (input.value || '').trim();
      if (!nameVal) {
        set('err', lang === 'ar' ? 'اكتب اسمك أو لقبك أولًا.' : 'Enter your name or handle first.');
        if (nameIn) nameIn.focus();
        return;
      }
      if (nameVal.length > 50) {
        set('err', lang === 'ar' ? 'الاسم طويل جدًا (حد أقصى 50 حرفًا).' : 'Name too long (max 50 chars).');
        if (nameIn) nameIn.focus();
        return;
      }
      if (nameIn) localStorage.setItem('tor-player-name', nameVal);
      if (!val) { set('err', lang === 'ar' ? 'اكتب الفلاج أولًا.' : 'Enter a flag first.'); input.focus(); return; }
      if (val.length > 200) { set('err', lang === 'ar' ? 'المدخل طويل بشكل غير متوقع.' : 'Input unexpectedly long.'); return; }
      btn.disabled = true;
      set('load', '<span class="spinner"></span> ' + (lang === 'ar' ? 'جارٍ التحقق من الفلاج…' : 'Verifying flag…'), true);
      fetch(TOR.apiBase() + '/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: TOR.identity(), name: nameVal, hideName: !!(hideIn && hideIn.checked), challenge: chId, flag: val })
      }).then(function (r) {
        return r.json().then(function (d) { return { code: r.status, d: d }; });
      }).then(function (res) {
        var d = res.d || {};
        if (res.code === 429) {
          btn.disabled = false;
          set('err', lang === 'ar' ? 'محاولات كثيرة بسرعة — انتظر دقيقة وحاول تاني.' : 'Too many attempts — wait a minute and retry.');
          return;
        }
        if (d.status === 'correct') {
          set('ok', lang === 'ar' ? 'فلاج صحيح! اتسجّل الحل باسم «' + nameVal + '» ✓' : 'Correct flag! Solve recorded for "' + nameVal + '" ✓');
          btn.disabled = true;
          btn.textContent = lang === 'ar' ? 'تم الحل ✓' : 'Solved ✓';
          btn.style.opacity = '0.7';
          btn.style.cursor = 'default';
          if (input) {
            input.disabled = true;
            input.placeholder = lang === 'ar' ? 'تم حل التحدي بنجاح' : 'Challenge already solved';
          }
          TOR.markLocalSolve(chId);
          document.querySelectorAll('[data-solve-badge="' + chId + '"]').forEach(function (b) {
            b.hidden = false; b.textContent = T.solved; b.classList.add('yes');
          });
          loadSolvers();
        } else if (d.status === 'already') {
          set('ok', lang === 'ar' ? 'هذا التحدي محلول بالفعل باسم «' + (d.name || nameVal) + '» ✓' : 'Already solved by "' + (d.name || nameVal) + '" ✓');
          btn.disabled = true;
          btn.textContent = lang === 'ar' ? 'تم الحل ✓' : 'Solved ✓';
          btn.style.opacity = '0.7';
          btn.style.cursor = 'default';
          if (input) {
            input.disabled = true;
            input.placeholder = lang === 'ar' ? 'تم حل التحدي بنجاح' : 'Challenge already solved';
          }
          TOR.markLocalSolve(chId);
          loadSolvers();
        } else if (d.status === 'wrong') {
          btn.disabled = false;
          set('err', lang === 'ar' ? 'فلاج غير صحيح. راجع الأدلة وحاول مرة أخرى.' : 'Incorrect flag. Recheck the evidence and try again.');
        } else {
          btn.disabled = false;
          set('err', lang === 'ar' ? 'استجابة غير متوقعة من الخادم.' : 'Unexpected server response.');
        }
      }).catch(function () {
        btn.disabled = false;
        set('err', lang === 'ar' ? 'الخادم غير متاح — شغّل server/server.js وحاول تاني.' : 'Server unavailable — run server/server.js and retry.');
      });
    });
  })();

  // ---------- keep ?a=/?c=/?id= across the language toggle (mapping bilingual slugs) ----------
  var pill = document.querySelector('.pill-lang');
  if (pill && location.search) {
    var baseHref = pill.getAttribute('href').split('?')[0];
    var otherLang = lang === 'ar' ? 'en' : 'ar';
    var qParam = TOR.param('id') || TOR.param('c') || TOR.param('a');
    var mKind = /^(article|challenge|investigation)-(ar|en)$/.exec(page);
    var mappedSearch = location.search;
    if (mKind && qParam) {
      var foundItem = TOR.find(mKind[1] + 's', qParam);
      if (foundItem && foundItem.slug && foundItem.slug[otherLang]) {
        var keyName = TOR.param('id') ? 'id' : (TOR.param('c') ? 'c' : 'a');
        mappedSearch = '?' + keyName + '=' + encodeURIComponent(foundItem.slug[otherLang]);
      }
    }
    pill.setAttribute('href', baseHref + mappedSearch);
  }
})();

// ---------- spoiler gate ----------
(function () {
  var btn = document.getElementById('seal-btn');
  if (!btn) return;
  var walk = document.getElementById('walkthrough');
  var gateImg = document.getElementById('gate-img');
  var gateTitle = document.getElementById('gate-title');
  btn.addEventListener('click', function () {
    var opening = walk.hidden;
    walk.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    function swapGate(src) {
      if (!gateImg || !src) return;
      gateImg.src = src;
      if (gateImg.parentNode && gateImg.parentNode.tagName === 'PICTURE') {
        var s = gateImg.parentNode.querySelector('source[type="image/webp"]');
        if (s) {
          var stem = src.replace(/\.jpg$/i, '');
          s.srcset = stem + '-768.webp 768w, ' + stem + '.webp 1376w';
        }
      }
    }
    if (opening) {
      if (gateImg && gateImg.dataset.open) swapGate(gateImg.dataset.open);
      if (gateTitle && gateTitle.dataset.openText) gateTitle.textContent = gateTitle.dataset.openText;
      btn.textContent = btn.dataset.closeText;
      var h = walk.querySelector('[tabindex="-1"]');
      if (h) h.focus();
    } else {
      if (gateImg && gateImg.dataset.sealed) swapGate(gateImg.dataset.sealed);
      if (gateTitle && gateTitle.dataset.sealedText) gateTitle.textContent = gateTitle.dataset.sealedText;
      btn.textContent = btn.dataset.openText;
      btn.focus();
    }
  });
})();

// ---------- code copy ----------
(function () {
  document.querySelectorAll('.copy-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var pre = document.getElementById(b.dataset.target);
      if (!pre) return;
      var text = pre.innerText;
      function done() {
        var old = b.textContent;
        b.textContent = b.dataset.copiedLabel;
        setTimeout(function () { b.textContent = old; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });
})();

// ---------- fixed-field overrides from admin.html (this browser only) ----------
(function () {
  var page = document.body && document.body.getAttribute('data-page');
  if (!page) return;
  var ov = TOR.fieldOverrides();
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  var defs = (typeof SITE_CONTENT !== 'undefined' && SITE_CONTENT.defaults) || {};
  var base = /-(ar|en)$/.test(page) ? page : page + '-' + lang; // data-page may already carry the language
  function val(ckey) {
    var v = ov[page + ':' + ckey];
    if (v == null || v === '') v = defs[base + ':' + ckey]; // server-side admin edits
    return v;
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var PLACEHOLDER_MARKERS = ['to be added', 'تُضاف لاحقًا', 'يُضاف لاحقًا', 'تُضافان لاحقًا', 'يُضافان لاحقًا', 'placeholder', 'fabricated', 'أماكن مؤقتة'];
  function isPh(s) {
    if (typeof s !== 'string' || !s.trim()) return false;
    var low = s.toLowerCase();
    for (var i = 0; i < PLACEHOLDER_MARKERS.length; i++) if (low.indexOf(PLACEHOLDER_MARKERS[i].toLowerCase()) !== -1) return true;
    return false;
  }
  document.querySelectorAll('[data-ckey-from]').forEach(function (el) { // text owned by the About page (home teaser)
    var k = el.getAttribute('data-ckey-from'), ap = 'about-' + lang;
    var v = ov[ap + ':' + k]; if (v == null || v === '') v = defs[ap + ':' + k];
    if (isPh(v)) { el.style.display = 'none'; return; }
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-ckey]').forEach(function (el) {
    var v = val(el.getAttribute('data-ckey'));
    if (v == null || v === '') return;
    if (isPh(v)) { el.style.display = 'none'; return; }
    if (el.hasAttribute('data-multiline')) { el.innerHTML = esc(v).replace(/\n/g, '<br>'); }
    else { el.textContent = v; }
  });
  document.querySelectorAll('[data-ckey-href]').forEach(function (el) {
    var v = (val(el.getAttribute('data-ckey-href')) || '').trim();
    if (!v) return;
    if (el.getAttribute('data-ckey-href') === 'contact-email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) v = 'mailto:' + v;
    if (!/^https:\/\//i.test(v) && !/^mailto:/i.test(v)) return;
    el.setAttribute('href', v);
    el.classList.add('linked');
    var soon = el.querySelector('.soon');
    if (soon) soon.remove();
  });
})();

// ---------- current page in the main navigation ----------
(function () {
  var page = (document.body && document.body.getAttribute('data-page')) || '';
  var want = /^challenge/.test(page) ? 'challenges' : /^article/.test(page) ? 'articles' : /^investigation/.test(page) ? 'investigations' : /^scoreboard/.test(page) ? 'scoreboard' : /^about/.test(page) ? 'about' : '';
  if (!want) return;
  document.querySelectorAll('header.site nav.main a').forEach(function (a) {
    if (!a.classList.contains('pill-lang') && (a.getAttribute('href') || '').indexOf(want + '-') === 0) a.setAttribute('aria-current', 'page');
  });
})();

// ---------- mobile hamburger navigation ----------
(function () {
  var bar = document.querySelector('header.site .bar');
  var nav = document.querySelector('header.site nav.main');
  if (!bar || !nav) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  var isAr = document.documentElement.lang === 'ar' || /-ar$/.test(document.body && document.body.getAttribute('data-page') || '');
  btn.setAttribute('aria-label', isAr ? 'القائمة' : 'Navigation menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg class="icon-burger" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 6h16M4 12h16M4 18h16"></path></svg><svg class="icon-close" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 18L18 6M6 6l12 12"></path></svg>';
  bar.appendChild(btn);

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = nav.classList.toggle('open');
    btn.classList.toggle('active', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', function (e) {
    if (!bar.contains(e.target)) {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

// Optional site appearance and identity settings. No settings means original design.
(function(){
 if(typeof SITE_SETTINGS==='undefined')return;var s=SITE_SETTINGS,ar=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG&&SITE_CONFIG.arabic===false)?false:/-ar$/.test(document.body.dataset.page||'');
 if(s.gold)document.documentElement.style.setProperty('--gold',s.gold);
 if(s.font_ar)document.documentElement.style.setProperty('--body-ar',"'"+s.font_ar+"', sans-serif");
 if(s.mode==='light')document.documentElement.classList.add('light-mode');
 var name=s[ar?'name_ar':'name_en'],desc=s[ar?'description_ar':'description_en'];
 if(name)document.querySelectorAll('.brand .name,.brand-name').forEach(e=>e.textContent=name);
 if(desc){var m=document.querySelector('meta[name=description]')||document.createElement('meta');m.name='description';m.content=desc;document.head.appendChild(m)}
 if(s.logo&&TOR.imgOk(s.logo)){var old=document.querySelector('.brand svg');if(old){var im=document.createElement('img');im.src=s.logo;im.alt='';im.style.cssText='width:32px;height:32px;object-fit:contain';old.replaceWith(im)}}
 if(s.favicon&&TOR.imgOk(s.favicon)){var f=document.querySelector('link[rel=icon]')||document.createElement('link');f.rel='icon';f.href=s.favicon;document.head.appendChild(f)}
 if(s.social_image&&TOR.imgOk(s.social_image)){var m=document.createElement('meta');m.setAttribute('property','og:image');m.content=new URL(s.social_image,location.href).href;document.head.appendChild(m)}
 if(s.other_link&&TOR.urlOk(s.other_link)){var box=document.querySelector('.contact-row');if(box){var a=document.createElement('a');a.className='contact-chip linked';a.textContent=ar?'رابط آخر':'Other link';a.href=s.other_link;a.target='_blank';a.rel='noopener noreferrer';box.appendChild(a)}}
})();

if(document.body.dataset.adminPreview){var banner=document.createElement('div');banner.textContent=document.documentElement.lang==='ar'?'معاينة خاصة للأدمن للمحتوى المحفوظ، قد تشمل مسودات.':'Private admin preview of saved content, may include drafts.';banner.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;text-align:center;background:#D7B776;color:#251F15;padding:10px;font:14px sans-serif';document.body.appendChild(banner)}
