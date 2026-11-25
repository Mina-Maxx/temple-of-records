'use strict';

const SECTION_TYPES = ['heading', 'paragraph', 'code', 'list', 'timeline', 'image', 'callout', 'chips', 'quote', 'table', 'link', 'inline_code'];

function cleanStr(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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

function urlOk(u) {
  return u === '' || (typeof u === 'string' && /^https:\/\/.+\..+/.test(u) && u.length < 2000);
}

function validateSection(sec, p, isChallenge) {
  let errors = [];
  if (!sec || typeof sec !== 'object') return { errors: [p + ': قسم غير صالح'] };
  if (SECTION_TYPES.indexOf(sec.type) === -1) return { errors: [p + ': نوع قسم غير معروف'] };
  const out = { type: sec.type, published: sec.published !== false };
  if (isChallenge) out.zone = sec.zone === 'solution' ? 'solution' : 'main';
  function str(k, max) {
    const v = cleanStr(sec[k] == null ? '' : sec[k], max);
    if (v === null) errors.push(p + '.' + k + ': نص طويل جدًا أو غير صالح');
    return v || '';
  }
  if (['heading', 'paragraph', 'chips', 'quote', 'inline_code', 'link'].includes(sec.type)) {
    out.ar = str('ar', 5000);
    out.en = str('en', 5000);
  } else if (sec.type === 'code') {
    out.label_ar = str('label_ar', 200);
    out.label_en = str('label_en', 200);
    out.code = str('code', 20000);
  } else if (sec.type === 'list') {
    out.ordered = !!sec.ordered;
    out.items = [];
    (Array.isArray(sec.items) ? sec.items : []).slice(0, 60).forEach((it, i) => {
      if (!isLangObj(it, 1000)) { errors.push(p + '.items[' + i + ']: غير صالح'); return; }
      out.items.push({ ar: cleanStr(it.ar, 1000), en: cleanStr(it.en, 1000) });
    });
  } else if (sec.type === 'timeline') {
    out.rows = [];
    (Array.isArray(sec.rows) ? sec.rows : []).slice(0, 60).forEach((r, i) => {
      if (!r || typeof r !== 'object' || !isLangObj(r, 1000) || cleanStr(r.t || '', 60) === null) {
        errors.push(p + '.rows[' + i + ']: غير صالح');
        return;
      }
      out.rows.push({ t: cleanStr(r.t, 60), ar: cleanStr(r.ar, 1000), en: cleanStr(r.en, 1000) });
    });
  } else if (sec.type === 'table') {
    const cell = x => ({ ar: cleanStr((x && x.ar) || '', 2000) || '', en: cleanStr((x && x.en) || '', 2000) || '' });
    out.headers = (Array.isArray(sec.headers) ? sec.headers : []).slice(0, 12).map(cell);
    out.rows = (Array.isArray(sec.rows) ? sec.rows : []).slice(0, 100).map(row => (Array.isArray(row) ? row : []).slice(0, 12).map(cell));
  } else if (sec.type === 'image') {
    if (!imgOk(sec.src || '')) errors.push(p + '.src: صورة غير صالحة (assets/ أو صورة مرفوعة)');
    out.src = imgOk(sec.src || '') ? sec.src : 'assets/archive.jpg';
    out.caption_ar = str('caption_ar', 500);
    out.caption_en = str('caption_en', 500);
    out.alt_ar = str('alt_ar', 300);
    out.alt_en = str('alt_en', 300);
  } else if (sec.type === 'callout') {
    out.title_ar = str('title_ar', 200);
    out.title_en = str('title_en', 200);
    out.ar = str('ar', 3000);
    out.en = str('en', 3000);
  }
  if (sec.type === 'link') {
    if (!urlOk(sec.url || '')) errors.push(p + '.url: https required');
    out.url = sec.url || '';
  }
  return { errors, value: errors.length ? null : out };
}

function validateEntry(e, kind, idx, opts) {
  const p = kind + '[' + idx + ']';
  const arEnabled = !(opts && opts.arabicEnabled === false);
  let errors = [];
  if (!e || typeof e !== 'object') return { errors: [p + ': عنصر غير صالح'] };
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(e.id || '')) errors.push(p + ': المعرّف (id) لازم حروف إنجليزية صغيرة وأرقام وشرطات');
  const out = { id: e.id || '', hidden: !!e.hidden };
  if (e.image && !imgOk(e.image)) errors.push(p + ': الصورة غير صالحة');
  out.image = imgOk(e.image || '') ? e.image : (kind === 'articles' ? 'assets/archive.jpg' : 'assets/challenge.jpg');
  function str(k, max) {
    const v = cleanStr(e[k] == null ? '' : e[k], max);
    if (v === null) errors.push(p + '.' + k + ': غير صالح');
    return v || '';
  }
  function lang(k, max) {
    const o = e[k] || {};
    if (!isLangObj(o, max)) { errors.push(p + '.' + k + ': غير صالح'); return { ar: '', en: '' }; }
    return { ar: cleanStr(o.ar, max), en: cleanStr(o.en, max) };
  }
  out.slug = lang('slug', 120);
  ['ar', 'en'].forEach(l => {
    if (out.slug[l] && !/^[\p{L}\p{N}-]+$/u.test(out.slug[l])) errors.push(p + '.slug.' + l + ': حروف وأرقام وشرطات فقط');
  });
  out.status = ['draft', 'published', 'archived'].indexOf(e.status) > -1 ? e.status : (e.hidden ? 'archived' : 'published');
  out.title = lang('title', 300);
  if (!arEnabled && (!out.title.en || !out.title.en.trim())) errors.push(p + '.title.en: English title required');
  out.excerpt = lang('excerpt', 2000);
  out.date = str('date', 100);
  out.tags = (Array.isArray(e.tags) ? e.tags : []).slice(0, 10).map(t => cleanStr(String(t), 40)).filter(Boolean);
  out.chips = (Array.isArray(e.chips) ? e.chips : []).slice(0, 6).map((c, i) => {
    if (!isLangObj(c, 80)) { errors.push(p + '.chips[' + i + ']: غير صالح'); c = {}; }
    return { ar: cleanStr(c.ar || '', 80), en: cleanStr(c.en || '', 80), gold: !!c.gold };
  });
  if (Array.isArray(e.attack)) {
    out.attack = e.attack.slice(0, 20).map(t => String(t).trim().toUpperCase()).filter(t => /^T\d{4}(\.\d{3})?$/.test(t));
  }
  if (e.publish_at) {
    const d = new Date(String(e.publish_at));
    if (isNaN(d.getTime())) errors.push(p + '.publish_at: invalid ISO date');
    else out.publish_at = d.toISOString();
  }
  if (kind === 'articles') {
    out.minutes = str('minutes', 60);
    out.category = lang('category', 120);
    out.seo_title = lang('seo_title', 200);
    out.meta_description = lang('meta_description', 500);
  } else {
    out.featured = !!e.featured;
    out.scenario = lang('scenario', 10000);
    out.objectives = lang('objectives', 5000);
    out.required_skills = lang('required_skills', 3000);
    out.tools = lang('tools', 3000);
    out.instructions = lang('instructions', 5000);
    out.category = lang('category', 120);
    out.difficulty = lang('difficulty', 120);
    out.points = Math.max(0, Math.min(100000, parseInt(e.points, 10) || 0));
    out.est_time = lang('est_time', 120);
    out.availability = ['open', 'soon', 'archived'].indexOf(e.availability) > -1 ? e.availability : 'soon';
    out.sample = !!e.sample;
    if (e.solution_public === true) out.solution_public = true;
    out.level = str('level', 100);
    const repo = e.repo || {};
    if (!urlOk(repo.url || '')) errors.push(p + '.repo.url: لازم https أو فاضي');
    out.repo = {
      url: urlOk(repo.url || '') ? repo.url : '',
      label_ar: cleanStr(repo.label_ar || '', 120) || '',
      label_en: cleanStr(repo.label_en || '', 120) || ''
    };
    out.hints = (Array.isArray(e.hints) ? e.hints : []).slice(0, 12).map((h, i) => {
      if (!isLangObj(h, 1000)) { errors.push(p + '.hints[' + i + ']: غير صالح'); h = {}; }
      const ho = { ar: cleanStr(h.ar || '', 1000), en: cleanStr(h.en || '', 1000), published: h.published !== false };
      if (h.cost != null && Number.isFinite(Number(h.cost)) && Number(h.cost) > 0) ho.cost = Math.floor(Number(h.cost));
      return ho;
    });
    const fl = e.flag || {};
    out.flag = { format_ar: cleanStr(fl.format_ar || '', 200) || '', format_en: cleanStr(fl.format_en || '', 200) || '' };
    out.artifacts = (Array.isArray(e.artifacts) ? e.artifacts : []).slice(0, 30).map((a, i) => {
      const ap = p + '.artifacts[' + i + ']';
      if (!a || typeof a !== 'object') { errors.push(ap + ': غير صالح'); a = {}; }
      if (!urlOk(a.url || '')) errors.push(ap + '.url: لازم https أو فاضي');
      if (!urlOk(a.mirror || '')) errors.push(ap + '.mirror: لازم https أو فاضي');
      if (a.sha256 && !/^[a-f0-9]{64}$/.test(a.sha256)) errors.push(ap + '.sha256: لازم 64 خانة hex صغيرة أو فاضي');
      return {
        name: cleanStr(a.name || '', 200) || '',
        type: cleanStr(a.type || '', 40) || '',
        size: cleanStr(a.size || '', 40) || '',
        sha256: (/^[a-f0-9]{64}$/.test(a.sha256 || '') ? a.sha256 : ''),
        desc_ar: cleanStr(a.desc_ar || '', 500) || '',
        desc_en: cleanStr(a.desc_en || '', 500) || '',
        url: urlOk(a.url || '') ? a.url : '',
        mirror: urlOk(a.mirror || '') ? a.mirror : '',
        visibility: a.visibility === 'hidden' ? 'hidden' : 'public',
        status: ['available', 'unavailable', 'planned'].indexOf(a.status) > -1 ? a.status : 'available'
      };
    });
  }
  out.sections = [];
  (Array.isArray(e.sections) ? e.sections : []).slice(0, 100).forEach((sec, i) => {
    const r = validateSection(sec, p + '.sections[' + i + ']', kind === 'challenges');
    if (r.errors.length) errors = errors.concat(r.errors);
    else out.sections.push(r.value);
  });
  return { errors, value: errors.length ? null : out };
}

function validateCollections(obj, opts) {
  let errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['collections: not an object'] };
  const out = { articles: [], challenges: [] };
  ['articles', 'challenges'].forEach(kind => {
    const arr = Array.isArray(obj[kind]) ? obj[kind] : [];
    if (arr.length > 50) { errors.push(kind + ': عدد كبير جدًا (الحد 50)'); return; }
    const ids = {};
    arr.forEach((e, i) => {
      const r = validateEntry(e, kind, i, opts);
      if (r.errors.length) { errors = errors.concat(r.errors); return; }
      if (ids[r.value.id]) { errors.push(kind + '[' + i + ']: معرّف مكرر ' + r.value.id); return; }
      ids[r.value.id] = true;
      out[kind].push(r.value);
    });
  });
  return { ok: errors.length === 0, value: out, errors };
}

module.exports = { cleanStr, isLangObj, imgOk, urlOk, validateSection, validateEntry, validateCollections };
