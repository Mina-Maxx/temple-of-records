// The Temple of Records — local content editor (admin.html)
// Pure validation/export helpers are exposed as window.TorAdmin for testing.
window.TorAdmin = (function () {
  'use strict';

  var SECTION_TYPES = ['heading', 'paragraph', 'code', 'list', 'timeline', 'image', 'callout', 'chips', 'quote', 'table', 'link', 'inline_code'];
  var TYPE_NAMES = {
    heading: 'عنوان قسم', paragraph: 'فقرة', code: 'بلوك كود/سجل', list: 'قائمة',
    timeline: 'خط زمني', image: 'صورة', callout: 'ملاحظة مميزة', chips: 'وسوم تقنية (سطر)'
  };

  // ---------- pure helpers ----------
  function cleanStr(v, max) {
    if (typeof v !== 'string') return null;
    var s = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (s.length > (max || 20000)) return null;
    return s;
  }
  function isLangObj(o, max) {
    return o && typeof o === 'object' && cleanStr(o.ar || '', max) !== null && cleanStr(o.en || '', max) !== null;
  }
  function imgOk(src) {
    return typeof src === 'string' &&
      (/^assets\/[A-Za-z0-9._-]+$/.test(src) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src));
  }
  function urlOk(u) { return u === '' || (typeof u === 'string' && /^https:\/\/.+\..+/.test(u) && u.length < 2000); }

  function knownFixedKeys() {
    var keys = {};
    SITE_CONTENT.fields.forEach(function (f) {
      ['ar', 'en'].forEach(function (lang) { keys[f.page + '-' + lang + ':' + f.key] = true; });
    });
    return keys;
  }

  function validateFixed(obj) {
    var errors = [], out = {}, known = knownFixedKeys();
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['fixed: not an object'] };
    Object.keys(obj).forEach(function (k) {
      if (!/^[a-z]+-(ar|en):[a-z0-9-]+$/.test(k) || !known[k]) { errors.push('حقل غير معروف: ' + k); return; }
      var v = cleanStr(obj[k], 20000);
      if (v === null) { errors.push('قيمة غير صالحة: ' + k); return; }
      out[k] = v;
    });
    return { ok: errors.length === 0, value: out, errors: errors };
  }

  function validateSection(sec, path, isChallenge) {
    var errors = [];
    if (!sec || typeof sec !== 'object') return { errors: [path + ': قسم غير صالح'] };
    if (SECTION_TYPES.indexOf(sec.type) === -1) return { errors: [path + ': نوع قسم غير معروف'] };
    var out = { type: sec.type, published: sec.published !== false };
    if (isChallenge) out.zone = sec.zone === 'solution' ? 'solution' : 'main';
    function str(k, max) {
      var v = cleanStr(sec[k] == null ? '' : sec[k], max);
      if (v === null) errors.push(path + '.' + k + ': نص طويل جدًا أو غير صالح');
      return v || '';
    }
    if (sec.type === 'heading' || sec.type === 'paragraph' || sec.type === 'chips' || sec.type === 'quote' || sec.type === 'inline_code' || sec.type === 'link') {
      out.ar = str('ar', 5000); out.en = str('en', 5000);
    } else if (sec.type === 'code') {
      out.label_ar = str('label_ar', 200); out.label_en = str('label_en', 200);
      out.code = str('code', 20000);
    } else if (sec.type === 'list') {
      out.ordered = !!sec.ordered;
      out.items = [];
      (Array.isArray(sec.items) ? sec.items : []).slice(0, 60).forEach(function (it, i) {
        if (!isLangObj(it, 1000)) { errors.push(path + '.items[' + i + ']: غير صالح'); return; }
        out.items.push({ ar: cleanStr(it.ar, 1000), en: cleanStr(it.en, 1000) });
      });
    } else if (sec.type === 'timeline') {
      out.rows = [];
      (Array.isArray(sec.rows) ? sec.rows : []).slice(0, 60).forEach(function (r, i) {
        if (!r || typeof r !== 'object' || !isLangObj(r, 1000) || cleanStr(r.t || '', 60) === null) {
          errors.push(path + '.rows[' + i + ']: غير صالح'); return;
        }
        out.rows.push({ t: cleanStr(r.t, 60), ar: cleanStr(r.ar, 1000), en: cleanStr(r.en, 1000) });
      });
    } else if (sec.type === 'table') {
      function cell(x) { return { ar: cleanStr(x && x.ar || '', 2000) || '', en: cleanStr(x && x.en || '', 2000) || '' }; }
      out.headers = (Array.isArray(sec.headers) ? sec.headers : []).slice(0,12).map(cell);
      out.rows = (Array.isArray(sec.rows) ? sec.rows : []).slice(0,100).map(function(row){return (Array.isArray(row)?row:[]).slice(0,12).map(cell)});
    } else if (sec.type === 'image') {
      if (!imgOk(sec.src || '')) errors.push(path + '.src: صورة غير صالحة (assets/ أو صورة مرفوعة)');
      out.src = imgOk(sec.src || '') ? sec.src : 'assets/archive.jpg';
      out.caption_ar = str('caption_ar', 500); out.caption_en = str('caption_en', 500);
      out.alt_ar = str('alt_ar', 300); out.alt_en = str('alt_en', 300);
    } else if (sec.type === 'callout') {
      out.title_ar = str('title_ar', 200); out.title_en = str('title_en', 200);
      out.ar = str('ar', 3000); out.en = str('en', 3000);
    }
    if(sec.type==='link'){if(!urlOk(sec.url||''))errors.push(path+'.url: https required');out.url=sec.url||''}
    return { errors: errors, value: errors.length ? null : out };
  }

  function validateEntry(e, kind, idx) {
    var path = kind + '[' + idx + ']';
    var errors = [];
    if (!e || typeof e !== 'object') return { errors: [path + ': عنصر غير صالح'] };
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(e.id || '')) errors.push(path + ': المعرّف (id) لازم حروف إنجليزية صغيرة وأرقام وشرطات');
    var out = { id: e.id || '', hidden: !!e.hidden };
    if (e.image && !imgOk(e.image)) errors.push(path + ': الصورة غير صالحة');
    out.image = imgOk(e.image || '') ? e.image : (kind === 'articles' ? 'assets/archive.jpg' : 'assets/challenge.jpg');
    function str(k, max) {
      var v = cleanStr(e[k] == null ? '' : e[k], max);
      if (v === null) errors.push(path + '.' + k + ': غير صالح');
      return v || '';
    }
    function lang(k, max) {
      var o = e[k] || {};
      if (!isLangObj(o, max)) { errors.push(path + '.' + k + ': غير صالح'); return { ar: '', en: '' }; }
      return { ar: cleanStr(o.ar, max), en: cleanStr(o.en, max) };
    }
    out.slug = lang('slug', 120);
    ['ar','en'].forEach(function(l){if(out.slug[l] && !/^[\p{L}\p{N}-]+$/u.test(out.slug[l]))errors.push(path+'.slug.'+l+': حروف وأرقام وشرطات فقط')});
    out.status = ['draft','published','archived'].indexOf(e.status)>-1 ? e.status : (e.hidden ? 'archived' : 'published');
    out.title = lang('title', 300);
    out.excerpt = lang('excerpt', 2000);
    out.date = str('date', 100);
    out.tags = (Array.isArray(e.tags) ? e.tags : []).slice(0, 10)
      .map(function (t) { return cleanStr(String(t), 40); }).filter(Boolean);
    out.chips = (Array.isArray(e.chips) ? e.chips : []).slice(0, 6).map(function (c, i) {
      if (!isLangObj(c, 80)) { errors.push(path + '.chips[' + i + ']: غير صالح'); c = {}; }
      return { ar: cleanStr(c.ar || '', 80), en: cleanStr(c.en || '', 80), gold: !!c.gold };
    });
    if (kind === 'articles') {
      out.minutes = str('minutes', 60);
      out.category = lang('category',120);out.seo_title=lang('seo_title',200);out.meta_description=lang('meta_description',500);
    } else {
      out.featured=!!e.featured;
      out.scenario=lang('scenario',10000);out.objectives=lang('objectives',5000);out.required_skills=lang('required_skills',3000);out.tools=lang('tools',3000);out.instructions=lang('instructions',5000);
      out.category = lang('category', 120);
      out.difficulty = lang('difficulty', 120);
      out.points = Math.max(0, Math.min(100000, parseInt(e.points, 10) || 0));
      out.est_time = lang('est_time', 120);
      out.availability = ['open','soon','archived'].indexOf(e.availability)>-1 ? e.availability : 'soon';
      out.sample=!!e.sample;
      out.level = str('level', 100);
      var repo = e.repo || {};
      if (!urlOk(repo.url || '')) errors.push(path + '.repo.url: لازم https أو فاضي');
      out.repo = { url: urlOk(repo.url || '') ? repo.url : '', label_ar: cleanStr(repo.label_ar || '', 120) || '', label_en: cleanStr(repo.label_en || '', 120) || '' };
      out.hints = (Array.isArray(e.hints) ? e.hints : []).slice(0, 12).map(function (h, i) {
        if (!isLangObj(h, 1000)) { errors.push(path + '.hints[' + i + ']: غير صالح'); h = {}; }
        return { ar: cleanStr(h.ar || '', 1000), en: cleanStr(h.en || '', 1000), published: h.published !== false };
      });
      var fl = e.flag || {};
      out.flag = { format_ar: cleanStr(fl.format_ar || '', 200) || '', format_en: cleanStr(fl.format_en || '', 200) || '' };
      out.artifacts = (Array.isArray(e.artifacts) ? e.artifacts : []).slice(0, 30).map(function (a, i) {
        var ap = path + '.artifacts[' + i + ']';
        if (!a || typeof a !== 'object') { errors.push(ap + ': غير صالح'); a = {}; }
        if (!urlOk(a.url || '')) errors.push(ap + '.url: لازم https أو فاضي');
        if (!urlOk(a.mirror || '')) errors.push(ap + '.mirror: لازم https أو فاضي');
        if (a.sha256 && !/^[a-f0-9]{64}$/.test(a.sha256)) errors.push(ap + '.sha256: لازم 64 خانة hex صغيرة أو فاضي');
        return {
          name: cleanStr(a.name || '', 200) || '', type: cleanStr(a.type || '', 40) || '',
          size: cleanStr(a.size || '', 40) || '', sha256: (/^[a-f0-9]{64}$/.test(a.sha256 || '') ? a.sha256 : ''),
          desc_ar: cleanStr(a.desc_ar || '', 500) || '', desc_en: cleanStr(a.desc_en || '', 500) || '',
          url: urlOk(a.url || '') ? a.url : '', mirror: urlOk(a.mirror || '') ? a.mirror : '',
          visibility: a.visibility === 'hidden' ? 'hidden' : 'public',
          status: ['available', 'unavailable', 'planned'].indexOf(a.status) > -1 ? a.status : 'available'
        };
      });
    }
    out.sections = [];
    (Array.isArray(e.sections) ? e.sections : []).slice(0, 100).forEach(function (sec, i) {
      var r = validateSection(sec, path + '.sections[' + i + ']', kind === 'challenges');
      if (r.errors.length) errors = errors.concat(r.errors);
      else out.sections.push(r.value);
    });
    return { errors: errors, value: errors.length ? null : out };
  }

  function validateCollections(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['collections: not an object'] };
    var out = { articles: [], challenges: [] };
    ['articles', 'challenges'].forEach(function (kind) {
      var arr = Array.isArray(obj[kind]) ? obj[kind] : [];
      if (arr.length > 50) { errors.push(kind + ': عدد كبير جدًا (الحد 50)'); return; }
      var ids = {};
      arr.forEach(function (e, i) {
        var r = validateEntry(e, kind, i);
        if (r.errors.length) { errors = errors.concat(r.errors); return; }
        if (ids[r.value.id]) { errors.push(kind + '[' + i + ']: معرّف مكرر ' + r.value.id); return; }
        ids[r.value.id] = true;
        out[kind].push(r.value);
      });
    });
    return { ok: errors.length === 0, value: out, errors: errors };
  }

  function validateImport(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['الملف مش بالصيغة المتوقعة'] };
    var fixed = { ok: true, value: {}, errors: [] };
    var collections = { ok: true, value: null, errors: [] };
    if (obj.fixed != null) fixed = validateFixed(obj.fixed);
    if (obj.collections != null) collections = validateCollections(obj.collections);
    var errors = fixed.errors.concat(collections.errors);
    return { ok: errors.length === 0, fixed: fixed.value, collections: collections.value, errors: errors };
  }

  function buildContentJs(fixedMap, collections) {
    var defaults = {};
    Object.keys(SITE_CONTENT.defaults).forEach(function (k) {
      defaults[k] = (fixedMap && fixedMap[k] != null && fixedMap[k] !== '') ? fixedMap[k] : SITE_CONTENT.defaults[k];
    });
    return '// The Temple of Records — editable content (fixed fields + collections).\n'
      + '// Regenerated by admin.html export; replacing this file makes browser edits permanent.\n'
      + 'const SITE_CONTENT = ' + JSON.stringify({ fields: SITE_CONTENT.fields, defaults: defaults }, null, 1) + ';\n'
      + 'const SITE_COLLECTIONS = ' + JSON.stringify(collections, null, 1) + ';\n';
  }

  // ---------- editor state ----------
  var state = { collections: null };

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function curCollections() {
    if (!state.collections) {
      try {
        var raw = localStorage.getItem('tor-collections');
        if (raw) {
          var v = validateCollections(JSON.parse(raw));
          if (v.ok) { state.collections = v.value; return state.collections; }
        }
      } catch (e) {}
      state.collections = deepCopy(SITE_COLLECTIONS);
    }
    return state.collections;
  }

  // ---------- DOM helpers ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function field(labelText, input) {
    var w = el('div', 'ed-field');
    var l = el('label', null, labelText); w.appendChild(l); w.appendChild(input);
    return w;
  }
  function inp(path, value, kind) {
    var i = document.createElement('input');
    i.type = 'text'; i.value = value == null ? '' : value;
    i.setAttribute('data-path', path);
    if (kind) i.setAttribute('data-kind', kind);
    return i;
  }
  function area(path, value, rows, mono) {
    var t = document.createElement('textarea');
    t.rows = rows || 3; t.value = value == null ? '' : value;
    t.setAttribute('data-path', path);
    if (mono) t.className = 'mono';
    return t;
  }
  function langPair(path, obj, rows, mono) {
    var g = el('div', 'ed-grid2');
    var a = rows ? area(path + '.ar', obj && obj.ar, rows, mono) : inp(path + '.ar', obj && obj.ar);
    var b = rows ? area(path + '.en', obj && obj.en, rows, mono) : inp(path + '.en', obj && obj.en);
    a.dir = 'rtl'; a.lang = 'ar'; b.dir = 'ltr'; b.lang = 'en';
    g.appendChild(field('العربي', a)); g.appendChild(field('English', b));
    return g;
  }
  function linesToPairs(text) {
    return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var parts = l.split('||').map(function (x) { return x.trim(); });
      return { ar: parts[0] || '', en: parts[1] || '', t: parts[0] || '' };
    });
  }
  function pairsToLines(arr, withTime) {
    return (arr || []).map(function (x) {
      return withTime ? ((x.t || '') + ' || ' + (x.ar || '') + ' || ' + (x.en || '')) : ((x.ar || '') + ' || ' + (x.en || ''));
    }).join('\n');
  }

  // ---------- sections editor ----------
  function sectionEditor(sec, path, isChallenge) {
    var box = el('div', 'ed-sec');
    var head = el('div', 'ed-sec-head');
    head.appendChild(el('span', 'ed-sec-type', TYPE_NAMES[sec.type] || sec.type));
    var tools = el('div', 'ed-tools');
    if (isChallenge) {
      var z = document.createElement('select');
      z.setAttribute('data-path', path + '.zone');
      [['main', 'قبل الختم'], ['solution', 'داخل الحل']].forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
        if ((sec.zone || 'main') === o[0]) op.selected = true;
        z.appendChild(op);
      });
      tools.appendChild(z);
    }
    [['up', '↑'], ['down', '↓']].forEach(function (m) {
      var b = el('button', 'mini', m[1]); b.type = 'button';
      b.setAttribute('data-act', m[0]); tools.appendChild(b);
    });
    var del = el('button', 'mini warn', 'حذف'); del.type = 'button'; del.setAttribute('data-act', 'del');
    tools.appendChild(del);
    head.appendChild(tools);
    box.appendChild(head);

    if (sec.type === 'heading') box.appendChild(langPair(path, sec));
    else if (sec.type === 'paragraph') box.appendChild(langPair(path, sec, 3));
    else if (sec.type === 'chips') box.appendChild(langPair(path, sec));
    else if (sec.type === 'callout') {
      var tg = el('div', 'ed-grid2');
      var ta = inp(path + '.title_ar', sec.title_ar); ta.dir = 'rtl';
      var te = inp(path + '.title_en', sec.title_en); te.dir = 'ltr';
      tg.appendChild(field('عنوان الملاحظة — عربي', ta)); tg.appendChild(field('عنوان الملاحظة — English', te));
      box.appendChild(tg);
      box.appendChild(langPair(path, sec, 2));
    }
    else if (sec.type === 'code') {
      var lg = el('div', 'ed-grid2');
      var la = inp(path + '.label_ar', sec.label_ar); la.dir = 'rtl';
      var le = inp(path + '.label_en', sec.label_en); le.dir = 'ltr';
      lg.appendChild(field('تسمية البلوك — عربي', la)); lg.appendChild(field('تسمية البلوك — English', le));
      box.appendChild(lg);
      box.appendChild(field('الكود / السجل (مشترك بين اللغتين)', area(path + '.code', sec.code, 6, true)));
    }
    else if (sec.type === 'list') {
      var cw = el('label', 'ed-check');
      var c = document.createElement('input'); c.type = 'checkbox';
      c.checked = !!sec.ordered; c.setAttribute('data-path', path + '.ordered'); c.setAttribute('data-kind', 'check');
      cw.appendChild(c); cw.appendChild(document.createTextNode('قائمة مرقّمة'));
      box.appendChild(cw);
      box.appendChild(field('البنود — سطر لكل بند: العربي || English', area(path + '.items', pairsToLines(sec.items), 4)));
    }
    else if (sec.type === 'timeline') {
      box.appendChild(field('الأحداث — سطر لكل حدث: الوقت || العربي || English', area(path + '.rows', pairsToLines(sec.rows, true), 4)));
    }
    else if (sec.type === 'image') {
      box.appendChild(imagePicker(path + '.src', sec.src));
      var cg = el('div', 'ed-grid2');
      var ca = inp(path + '.caption_ar', sec.caption_ar); ca.dir = 'rtl';
      var ce = inp(path + '.caption_en', sec.caption_en); ce.dir = 'ltr';
      cg.appendChild(field('التعليق — عربي', ca)); cg.appendChild(field('التعليق — English', ce));
      box.appendChild(cg);
      var ag = el('div', 'ed-grid2');
      var aa = inp(path + '.alt_ar', sec.alt_ar); aa.dir = 'rtl';
      var ae = inp(path + '.alt_en', sec.alt_en); ae.dir = 'ltr';
      ag.appendChild(field('النص البديل — عربي', aa)); ag.appendChild(field('النص البديل — English', ae));
      box.appendChild(ag);
    }
    return box;
  }

  var ASSETS = ['assets/hero.jpg', 'assets/challenge.jpg', 'assets/scribe.jpg', 'assets/jars.jpg',
                'assets/vault-sealed.jpg', 'assets/vault-open.jpg', 'assets/archive.jpg'];

  function imagePicker(path, value) {
    var w = el('div', 'ed-field');
    w.appendChild(el('label', null, 'الصورة'));
    var sel = document.createElement('select');
    sel.setAttribute('data-path', path);
    ASSETS.forEach(function (a) {
      var op = document.createElement('option'); op.value = a; op.textContent = a;
      if (value === a) op.selected = true;
      sel.appendChild(op);
    });
    var custom = value && ASSETS.indexOf(value) === -1;
    var opC = document.createElement('option'); opC.value = '__custom';
    opC.textContent = custom ? 'صورة مرفوعة (محفوظة)' : '— ارفع صورة —';
    if (custom) opC.selected = true;
    sel.appendChild(opC);
    w.appendChild(sel);
    var file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp';
    file.setAttribute('data-upload-for', path);
    file.style.marginTop = '6px';
    w.appendChild(file);
    if (custom) {
      var img = document.createElement('img'); img.src = value; img.className = 'ed-imgprev'; img.alt = '';
      w.appendChild(img);
    }
    var hint = el('div', 'ed-hint', 'الصور المرفوعة بتتصغّر وتتحفظ داخل الملف المُصدَّر (حد ~800KB بعد الضغط).');
    w.appendChild(hint);
    return w;
  }

  // ---------- entry editor ----------
  function entryEditor(e, kind, idx) {
    var base = kind + '.' + idx;
    var box = el('div', 'ed-item');
    var head = el('div', 'ed-item-head');
    head.appendChild(el('h3', null, (e.title && (e.title.ar || e.title.en)) || '(بدون عنوان)'));
    var tools = el('div', 'ed-tools');
    [['up', '↑'], ['down', '↓']].forEach(function (m) {
      var b = el('button', 'mini', m[1]); b.type = 'button';
      b.setAttribute('data-act', m[0]); tools.appendChild(b);
    });
    var hide = el('button', 'mini', e.hidden ? 'إظهار' : 'إخفاء'); hide.type = 'button'; hide.setAttribute('data-act', 'hide');
    var del = el('button', 'mini warn', 'حذف'); del.type = 'button'; del.setAttribute('data-act', 'del');
    tools.appendChild(hide); tools.appendChild(del);
    head.appendChild(tools);
    box.appendChild(head);

    var idw = el('div', 'ed-grid3');
    var idi = inp(base + '.id', e.id); idi.dir = 'ltr'; idi.className = 'mono';
    idw.appendChild(field('المعرّف (id) — إنجليزي بس', idi));
    var datei = inp(base + '.date', e.date); datei.dir = 'ltr';
    idw.appendChild(field('التاريخ', datei));
    var tagi = inp(base + '.tags', (e.tags || []).join(', '), 'comma'); tagi.dir = 'ltr';
    idw.appendChild(field('وسوم (افصل بفواصل)', tagi));
    box.appendChild(idw);

    box.appendChild(field('العنوان', langPair(base + '.title', e.title)));
    box.appendChild(field('الملخص (يظهر في الكروت)', langPair(base + '.excerpt', e.excerpt, 2)));
    box.appendChild(field('شرائح الحالة — سطر لكل شريحة: العربي || English (* في الأول = ذهبي)', area(base + '.chips', pairsToLines(e.chips), 2)));

    if (kind === 'articles') {
      var mw = el('div', 'ed-grid3');
      mw.appendChild(field('زمن القراءة', inp(base + '.minutes', e.minutes)));
      box.appendChild(mw);
    } else {
      var g1 = el('div', 'ed-grid2');
      g1.appendChild(field('التصنيف', langPair(base + '.category', e.category)));
      g1.appendChild(field('الصعوبة', langPair(base + '.difficulty', e.difficulty)));
      box.appendChild(g1);
      var g2 = el('div', 'ed-grid3');
      var p = inp(base + '.points', e.points, 'num'); p.dir = 'ltr';
      g2.appendChild(field('النقاط', p));
      g2.appendChild(field('الوقت المقدّر', langPairInline(base + '.est_time', e.est_time)));
      var av = document.createElement('select');
      av.setAttribute('data-path', base + '.availability');
      [['soon', 'قريبًا'], ['open', 'متاح']].forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
        if (e.availability === o[0]) op.selected = true;
        av.appendChild(op);
      });
      g2.appendChild(field('الحالة', av));
      box.appendChild(g2);
      box.appendChild(field('مستودع الكود — رابط https (اتركه فاضي لو لسه)', (function () {
        var i = inp(base + '.repo.url', e.repo && e.repo.url); i.dir = 'ltr'; i.className = 'mono'; return i;
      })()));
      box.appendChild(field('تلميحات — سطر لكل تلميح: العربي || English', area(base + '.hints', pairsToLines(e.hints), 3)));
      var fg = el('div', 'ed-grid2');
      var fa = inp(base + '.flag.format_ar', e.flag && e.flag.format_ar); fa.dir = 'rtl';
      var fe = inp(base + '.flag.format_en', e.flag && e.flag.format_en); fe.dir = 'ltr';
      fg.appendChild(field('صيغة الفلاج — عربي', fa)); fg.appendChild(field('صيغة الفلاج — English', fe));
      box.appendChild(fg);
      box.appendChild(el('div', 'ed-hint', 'الفلاج نفسه مش هنا إطلاقًا — بيتحط على الخادم فقط (server/flags.json).'));

      // artifacts
      var aw = el('div', null);
      aw.appendChild(el('div', 'ed-label', 'ملفات الأدلة (روابط خارجية يوفّرها صاحب التحدي — الملفات نفسها مش على سيرفر الموقع)'));
      (e.artifacts || []).forEach(function (a, ai) {
        var ab = el('div', 'ed-sec');
        var ah = el('div', 'ed-sec-head');
        ah.appendChild(el('span', 'ed-sec-type', a.name || 'ملف'));
        var ad = el('button', 'mini warn', 'حذف'); ad.type = 'button'; ad.setAttribute('data-act', 'del-art');
        ah.appendChild(ad); ab.appendChild(ah);
        var g = el('div', 'ed-grid3');
        var n1 = inp(base + '.artifacts.' + ai + '.name', a.name); n1.dir = 'ltr'; n1.className = 'mono';
        g.appendChild(field('اسم الملف', n1));
        var n2 = inp(base + '.artifacts.' + ai + '.type', a.type); n2.dir = 'ltr';
        g.appendChild(field('النوع', n2));
        var n3 = inp(base + '.artifacts.' + ai + '.size', a.size); n3.dir = 'ltr';
        g.appendChild(field('الحجم (نص)', n3));
        ab.appendChild(g);
        var s = inp(base + '.artifacts.' + ai + '.sha256', a.sha256); s.dir = 'ltr'; s.className = 'mono';
        ab.appendChild(field('SHA-256', s));
        var u = inp(base + '.artifacts.' + ai + '.url', a.url); u.dir = 'ltr'; u.className = 'mono';
        ab.appendChild(field('رابط التحميل https', u));
        var mi = inp(base + '.artifacts.' + ai + '.mirror', a.mirror); mi.dir = 'ltr'; mi.className = 'mono';
        ab.appendChild(field('رابط مرآة (اختياري)', mi));
        var dg = el('div', 'ed-grid2');
        var da = inp(base + '.artifacts.' + ai + '.desc_ar', a.desc_ar); da.dir = 'rtl';
        var de = inp(base + '.artifacts.' + ai + '.desc_en', a.desc_en); de.dir = 'ltr';
        dg.appendChild(field('الوصف — عربي', da)); dg.appendChild(field('الوصف — English', de));
        ab.appendChild(dg);
        aw.appendChild(ab);
      });
      var addA = el('button', 'mini', '+ إضافة ملف دليل'); addA.type = 'button'; addA.setAttribute('data-act', 'add-art');
      aw.appendChild(addA);
      box.appendChild(aw);
    }

    // sections
    var sw = el('div', null);
    sw.appendChild(el('div', 'ed-label', 'أقسام المحتوى'));
    (e.sections || []).forEach(function (sec, si) {
      sw.appendChild(sectionEditor(sec, base + '.sections.' + si, kind === 'challenges'));
    });
    var addRow = el('div', 'ed-add');
    var sel = document.createElement('select');
    SECTION_TYPES.forEach(function (t) {
      var op = document.createElement('option'); op.value = t; op.textContent = TYPE_NAMES[t];
      sel.appendChild(op);
    });
    var addB = el('button', 'mini', '+ إضافة قسم'); addB.type = 'button'; addB.setAttribute('data-act', 'add-sec');
    addRow.appendChild(sel); addRow.appendChild(addB);
    sw.appendChild(addRow);
    box.appendChild(sw);
    return box;
  }

  function langPairInline(path, obj) {
    var w = el('div', null);
    var a = inp(path + '.ar', obj && obj.ar); a.dir = 'rtl'; a.lang = 'ar';
    var b = inp(path + '.en', obj && obj.en); b.dir = 'ltr'; b.lang = 'en';
    a.style.marginBottom = '4px';
    w.appendChild(a); w.appendChild(b);
    return w;
  }

  // ---------- render + sync ----------
  var collBox;
  function renderCollections() {
    var c = curCollections();
    collBox.innerHTML = '';
    [['challenges', 'التحديات (CTF)'], ['articles', 'المقالات']].forEach(function (kg) {
      var kind = kg[0];
      var h = el('h2', null, kg[1]);
      h.style.cssText = 'font-family:var(--display-ar);color:var(--gold);font-size:22px;margin:34px 0 14px;';
      collBox.appendChild(h);
      c[kind].forEach(function (e, i) {
        var w = entryEditor(e, kind, i);
        w.setAttribute('data-entry', kind + '.' + i);
        collBox.appendChild(w);
      });
      var add = el('button', 'mini', kind === 'articles' ? '+ مقال جديد' : '+ تحدي جديد');
      add.type = 'button'; add.setAttribute('data-add-entry', kind);
      collBox.appendChild(add);
    });
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
      if (o[k] == null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = value;
  }

  function syncFromDOM() {
    var c = curCollections();
    collBox.querySelectorAll('[data-path]').forEach(function (inp) {
      var path = inp.getAttribute('data-path');
      var kindAttr = inp.getAttribute('data-kind');
      var v;
      if (kindAttr === 'check') v = inp.checked;
      else if (kindAttr === 'num') v = parseInt(inp.value, 10) || 0;
      else if (kindAttr === 'comma') v = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      else v = inp.value;
      if (path.slice(-6) === '.items') {
        v = inp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
          var p = l.split('||').map(function (x) { return x.trim(); });
          return { ar: p[0] || '', en: p[1] || '' };
        });
      } else if (path.slice(-5) === '.rows') {
        v = inp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
          var p = l.split('||').map(function (x) { return x.trim(); });
          return { t: p[0] || '', ar: p[1] || '', en: p[2] || '' };
        });
      } else if (path.slice(-6) === '.hints') {
        v = inp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
          var p = l.split('||').map(function (x) { return x.trim(); });
          return { ar: p[0] || '', en: p[1] || '' };
        });
      } else if (path.slice(-6) === '.chips') {
        v = inp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
          var gold = l.charAt(0) === '*';
          if (gold) l = l.slice(1).trim();
          var p = l.split('||').map(function (x) { return x.trim(); });
          return { ar: p[0] || '', en: p[1] || '', gold: gold };
        });
      }
      setPath(c, path, v);
    });
  }

  // ---------- structural actions (event delegation) ----------
  function locate(target) {
    var entryEl = target.closest('[data-entry]');
    if (!entryEl) return null;
    var parts = entryEl.getAttribute('data-entry').split('.');
    var secEl = target.closest('.ed-sec');
    var secIdx = null;
    if (secEl) {
      // find section index by data-path of first input inside
      var any = secEl.querySelector('[data-path]');
      if (any) {
        var m = any.getAttribute('data-path').match(/\.sections\.(\d+)/);
        if (m) secIdx = Number(m[1]);
      }
    }
    return { kind: parts[0], idx: Number(parts[1]), secIdx: secIdx };
  }

  function onClick(e) {
    var t = e.target.closest('[data-act], [data-add-entry]');
    if (!t) return;
    e.preventDefault();
    var status = document.getElementById('status');
    if (t.hasAttribute('data-add-entry')) {
      syncFromDOM();
      var kind = t.getAttribute('data-add-entry');
      var id = (kind === 'articles' ? 'article-' : 'challenge-') + Date.now().toString(36);
      var entry = {
        id: id, hidden: false,
        image: kind === 'articles' ? 'assets/archive.jpg' : 'assets/challenge.jpg',
        date: '', tags: [],
        title: { ar: '', en: '' }, excerpt: { ar: '', en: '' },
        chips: [{ ar: 'مسودة', en: 'Draft', gold: true }],
        sections: [{ type: 'heading', ar: '', en: '' }, { type: 'paragraph', ar: '', en: '' }]
      };
      if (kind === 'challenges') {
        entry.category = { ar: '', en: '' }; entry.difficulty = { ar: '', en: '' };
        entry.points = 100; entry.est_time = { ar: '', en: '' }; entry.availability = 'soon'; entry.level = '';
        entry.repo = { url: '', label_ar: 'مستودع الكود', label_en: 'Code repository' };
        entry.hints = []; entry.flag = { format_ar: 'صيغة الفلاج: TOR{…}', format_en: 'Flag format: TOR{…}' };
        entry.artifacts = [];
        entry.sections[0].zone = 'main'; entry.sections[1].zone = 'main';
      }
      curCollections()[kind].push(entry);
      renderCollections();
      status.textContent = 'اتضاف — عدّل بياناته واضغط حفظ.';
      return;
    }
    var loc = locate(t);
    if (!loc) return;
    var act = t.getAttribute('data-act');
    syncFromDOM();
    var arr = curCollections()[loc.kind];
    var entry = arr[loc.idx];
    var inHead = !!t.closest('.ed-item-head');
    var inSec = !!t.closest('.ed-sec');
    if (inHead) {
      if (act === 'del') {
        if (!confirm('حذف "' + ((entry.title && (entry.title.ar || entry.title.en)) || entry.id) + '" نهائيًا؟')) return;
        arr.splice(loc.idx, 1);
      } else if (act === 'hide') entry.hidden = !entry.hidden;
      else if (act === 'up' && loc.idx > 0) { arr.splice(loc.idx - 1, 0, arr.splice(loc.idx, 1)[0]); }
      else if (act === 'down' && loc.idx < arr.length - 1) { arr.splice(loc.idx + 1, 0, arr.splice(loc.idx, 1)[0]); }
    } else if (act === 'add-art') {
      entry.artifacts = entry.artifacts || [];
      entry.artifacts.push({ name: '', type: '', size: '', sha256: '', desc_ar: '', desc_en: '', url: '', mirror: '' });
    } else if (act === 'del-art' && inSec) {
      var anyI = t.closest('.ed-sec').querySelector('[data-path]');
      var mi = anyI && anyI.getAttribute('data-path').match(/\.artifacts\.(\d+)/);
      if (mi) entry.artifacts.splice(Number(mi[1]), 1);
    } else if (act === 'add-sec') {
      var sel = t.parentElement.querySelector('select');
      var type = sel ? sel.value : 'paragraph';
      var ns = { type: type, ar: '', en: '' };
      if (loc.kind === 'challenges') ns.zone = 'main';
      if (type === 'code') ns = { type: 'code', zone: ns.zone, label_ar: '', label_en: '', code: '' };
      if (type === 'list') ns = { type: 'list', zone: ns.zone, ordered: false, items: [] };
      if (type === 'timeline') ns = { type: 'timeline', zone: ns.zone, rows: [] };
      if (type === 'image') ns = { type: 'image', zone: ns.zone, src: 'assets/archive.jpg', caption_ar: '', caption_en: '', alt_ar: '', alt_en: '' };
      if (type === 'callout') ns = { type: 'callout', zone: ns.zone, title_ar: '', title_en: '', ar: '', en: '' };
      if (!ns.zone) delete ns.zone;
      entry.sections.push(ns);
    } else if (inSec && loc.secIdx != null && ['del', 'up', 'down'].indexOf(act) !== -1) {
      var ss = entry.sections;
      if (act === 'del') ss.splice(loc.secIdx, 1);
      else if (act === 'up' && loc.secIdx > 0) ss.splice(loc.secIdx - 1, 0, ss.splice(loc.secIdx, 1)[0]);
      else if (act === 'down' && loc.secIdx < ss.length - 1) ss.splice(loc.secIdx + 1, 0, ss.splice(loc.secIdx, 1)[0]);
    }
    renderCollections();
  }

  // ---------- uploads ----------
  function onChange(e) {
    var t = e.target;
    if (t.hasAttribute('data-upload-for')) {
      var file = t.files && t.files[0];
      if (!file) return;
      var status = document.getElementById('status');
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1400;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL('image/jpeg', 0.82);
          if (url.length > 800 * 1024) { status.textContent = 'الصورة كبيرة حتى بعد الضغط — جرّب صورة أصغر.'; return; }
          var path = t.getAttribute('data-upload-for');
          syncFromDOM();
          setPath(curCollections(), path, url);
          renderCollections();
          status.textContent = 'اترفعت الصورة ✓ اضغط حفظ.';
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
    if (t.id === 'import-input') {
      var f = t.files && t.files[0];
      if (!f) return;
      var status2 = document.getElementById('status');
      if (f.size > 4.5 * 1024 * 1024) { status2.textContent = 'الملف أكبر من 4.5MB — الحد الأقصى للتخزين المحلي.'; return; }
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          var v = validateImport(data);
          if (!v.ok) { status2.textContent = 'الملف مرفوض: ' + v.errors.slice(0, 3).join(' · '); return; }
          if (data.fixed != null) localStorage.setItem('tor-content', JSON.stringify(v.fixed));
          if (data.collections != null) {
            localStorage.setItem('tor-collections', JSON.stringify(v.collections));
            state.collections = null;
          }
          location.reload();
        } catch (err) { status2.textContent = 'الملف مش JSON صالح: ' + err.message; }
      };
      r.readAsText(f);
    }
  }

  // ---------- init ----------
  function init() {
    var form = document.getElementById('editor');
    if (!form) return; // not on admin page
    collBox = document.getElementById('collections');
    var status = document.getElementById('status');

    var ov = {};
    try { ov = JSON.parse(localStorage.getItem('tor-content') || '{}'); } catch (e) {}
    function defaults(k) { return SITE_CONTENT.defaults[k] || ''; }
    function cur(k) { var v = ov[k]; return (v != null && v !== '') ? v : defaults(k); }

    var groups = [];
    SITE_CONTENT.fields.forEach(function (f) {
      var g = groups.find(function (x) { return x.name === f.group; });
      if (!g) { g = { name: f.group, items: [] }; groups.push(g); }
      g.items.push(f);
    });
    groups.forEach(function (g) {
      var sec = el('section', 'ed-group');
      var h = el('h2', null, g.name); sec.appendChild(h);
      g.items.forEach(function (f) {
        var row = el('div', 'ed-row');
        row.appendChild(el('div', 'ed-label', f.label));
        ['ar', 'en'].forEach(function (lang) {
          var wrap = el('div', 'ed-field');
          wrap.appendChild(el('label', null, lang === 'ar' ? 'العربي' : 'English'));
          var key = f.page + '-' + lang + ':' + f.key;
          var input;
          if (f.type === 'area') { input = document.createElement('textarea'); input.rows = 3; }
          else { input = document.createElement('input'); input.type = 'text'; }
          input.setAttribute('data-key', key);
          input.dir = lang === 'ar' ? 'rtl' : 'ltr'; input.lang = lang;
          input.value = cur(key);
          wrap.appendChild(input); row.appendChild(wrap);
        });
        sec.appendChild(row);
      });
      form.appendChild(sec);
    });

    renderCollections();
    collBox.addEventListener('click', onClick);
    collBox.addEventListener('change', onChange);
    document.getElementById('import-input').addEventListener('change', onChange);

    function collectFixed(diffsOnly) {
      var out = {};
      form.querySelectorAll('[data-key]').forEach(function (i) {
        var k = i.getAttribute('data-key'), v = i.value;
        if (diffsOnly && v === defaults(k)) return;
        out[k] = v;
      });
      return out;
    }

    document.getElementById('save-btn').addEventListener('click', function () {
      syncFromDOM();
      var v = validateCollections(curCollections());
      if (!v.ok) { status.textContent = 'فيه حقول غير صالحة: ' + v.errors.slice(0, 3).join(' · '); return; }
      try {
        localStorage.setItem('tor-content', JSON.stringify(collectFixed(true)));
        localStorage.setItem('tor-collections', JSON.stringify(v.value));
        status.textContent = 'اتحفظت في المتصفح ده ✓ افتح معاينة الموقع عشان تشوفها.';
      } catch (e2) {
        status.textContent = 'الحفظ فشل (غالبًا مساحة المتصفح مليانة): صدّر content.js بدلًا منه. ' + e2.message;
      }
    });

    document.getElementById('export-js-btn').addEventListener('click', function () {
      syncFromDOM();
      var v = validateCollections(curCollections());
      if (!v.ok) { status.textContent = 'فيه حقول غير صالحة: ' + v.errors.slice(0, 3).join(' · '); return; }
      var js = buildContentJs(collectFixed(false), v.value);
      download(new Blob([js], { type: 'text/javascript' }), 'content.js');
      status.textContent = 'اتنزّل content.js ✓ استبدل بيه ملف content.js في فولدر الموقع — تعديلاتك تبقى دائمة.';
    });

    document.getElementById('export-json-btn').addEventListener('click', function () {
      syncFromDOM();
      var v = validateCollections(curCollections());
      if (!v.ok) { status.textContent = 'فيه حقول غير صالحة: ' + v.errors.slice(0, 3).join(' · '); return; }
      download(new Blob([JSON.stringify({ fixed: collectFixed(false), collections: v.value }, null, 1)], { type: 'application/json' }), 'temple-backup.json');
      status.textContent = 'اتنزّلت النسخة الاحتياطية ✓';
    });

    document.getElementById('reset-btn').addEventListener('click', function () {
      if (!confirm('مسح كل التعديلات المحلية والرجوع للمحتوى الأصلي؟')) return;
      localStorage.removeItem('tor-content');
      localStorage.removeItem('tor-collections');
      location.reload();
    });

    function download(blob, name) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
  }

  if (typeof document !== 'undefined') init();

  return {
    validateFixed: validateFixed, validateCollections: validateCollections,
    validateImport: validateImport, buildContentJs: buildContentJs,
    _cleanStr: cleanStr, _imgOk: imgOk, _urlOk: urlOk
  };
})();
