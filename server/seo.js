'use strict';

const fs = require('fs');
const path = require('path');
const visibility = require('./visibility');

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function imgOk(src) {
  return typeof src === 'string' && /^assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpg|jpeg|png|webp|gif|svg)$/i.test(src);
}

function plainText(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 160);
}

function loc(v, lang) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.en || v.ar || '';
}

function loadSettings(dataDir) {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'site-settings.json'), 'utf8')); } catch { return {}; }
}

function loadCollections(dataDir) {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'store.json'), 'utf8')).collections || {}; } catch { return {}; }
}

function render404(root) {
  let html = '';
  try { html = fs.readFileSync(path.join(root, '404.html'), 'utf8'); } catch { return 'Not found'; }
  if (!/name=["']robots["']/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="robots" content="noindex"/>');
  }
  return html;
}

function injectDetailMeta(html, pathname, url, root, dataDir) {
  const m = /^\/(article|challenge|investigation)-(ar|en)\.html$/.exec(pathname);
  if (!m) return { status: 200, html };

  const pageType = m[1];
  const lang = m[2];
  const colKey = pageType + 's';
  const idParam = url.searchParams.get('id') || url.searchParams.get('c') || url.searchParams.get('a') || '';
  if (!idParam) return { status: 200, html };

  const pubCols = visibility.publicCollections(loadCollections(dataDir));
  const list = pubCols[colKey] || [];
  const item = list.find(x => x.id === idParam || (x.slug && (x.slug[lang] === idParam || x.slug.ar === idParam || x.slug.en === idParam)));
  if (!item) {
    return { status: 404, html: render404(root) };
  }

  const cfg = loadSettings(dataDir);
  const baseUrl = (cfg.base_url && /^https:\/\/[^/\s]+$/.test(cfg.base_url)) ? cfg.base_url.replace(/\/$/, '') : '';
  const siteName = lang === 'ar' ? (cfg.name_ar || 'مينا مكس') : (cfg.name_en || 'Mina Max');
  const rawTitle = loc(item.seo_title, lang) || loc(item.title, lang) || item.id;
  const fullTitle = rawTitle + ' · ' + siteName;
  const desc = plainText(loc(item.meta_description, lang) || loc(item.excerpt, lang) || loc(item.summary, lang) || loc(item.description, lang), 160);

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escHtml(fullTitle) + '</title>')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '');

  const tags = [];
  if (desc) tags.push('<meta name="description" content="' + escHtml(desc) + '"/>');

  if (baseUrl) {
    const slugAr = (item.slug && item.slug.ar) || item.id;
    const slugEn = (item.slug && item.slug.en) || item.id;
    const urlAr = baseUrl + '/' + pageType + '-ar.html?id=' + encodeURIComponent(slugAr);
    const urlEn = baseUrl + '/' + pageType + '-en.html?id=' + encodeURIComponent(slugEn);
    const curUrl = lang === 'ar' ? urlAr : urlEn;
    const imgPath = imgOk(item.image) ? item.image : 'assets/hero.jpg';
    const imgUrl = baseUrl + '/' + imgPath;
    const ogType = pageType === 'article' ? 'article' : 'website';

    tags.push('<link rel="canonical" href="' + escHtml(curUrl) + '"/>');
    tags.push('<link rel="alternate" hreflang="ar" href="' + escHtml(urlAr) + '"/>');
    tags.push('<link rel="alternate" hreflang="en" href="' + escHtml(urlEn) + '"/>');
    tags.push('<link rel="alternate" hreflang="x-default" href="' + escHtml(urlEn) + '"/>');
    tags.push('<meta property="og:title" content="' + escHtml(fullTitle) + '"/>');
    if (desc) tags.push('<meta property="og:description" content="' + escHtml(desc) + '"/>');
    tags.push('<meta property="og:type" content="' + ogType + '"/>');
    tags.push('<meta property="og:url" content="' + escHtml(curUrl) + '"/>');
    tags.push('<meta property="og:image" content="' + escHtml(imgUrl) + '"/>');
    tags.push('<meta property="og:locale" content="' + (lang === 'ar' ? 'ar_EG' : 'en_US') + '"/>');
    tags.push('<meta name="twitter:card" content="summary_large_image"/>');
    tags.push('<meta name="twitter:title" content="' + escHtml(fullTitle) + '"/>');
    if (desc) tags.push('<meta name="twitter:description" content="' + escHtml(desc) + '"/>');
    tags.push('<meta name="twitter:image" content="' + escHtml(imgUrl) + '"/>');
  }

  const ld = {
    '@context': 'https://schema.org',
    '@type': pageType === 'article' ? 'Article' : (pageType === 'challenge' ? 'LearningResource' : 'CreativeWork'),
    headline: rawTitle,
    inLanguage: lang === 'ar' ? 'ar' : 'en',
    author: { '@type': 'Person', name: 'Mina Max' }
  };
  if (desc) ld.description = desc;
  if (item.date) { ld.datePublished = item.date; ld.dateModified = item.date; }
  if (Array.isArray(item.attack) && item.attack.length) ld.keywords = item.attack.join(', ');
  tags.push('<script type="application/ld+json">' + safeJsonLd(ld) + '</script>');

  out = out.replace('</head>', tags.join('\n') + '\n</head>');
  return { status: 200, html: out };
}

function injectStaticMeta(html, dataDir) {
  const cfg = loadSettings(dataDir);
  const baseUrl = (cfg.base_url && /^https:\/\/[^/\s]+$/.test(cfg.base_url)) ? cfg.base_url.replace(/\/$/, '') : '';
  if (baseUrl) {
    return html.replace(/https:\/\/mina-max\.website/g, baseUrl);
  }
  return html
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']alternate["'][^>]*hreflang=[^>]*>\s*/gi, '')
    .replace(/<meta\s+(?:property|name)=["'](?:og:url|og:image|twitter:image)["'][^>]*>\s*/gi, '');
}

module.exports = { escHtml, safeJsonLd, render404, injectDetailMeta, injectStaticMeta, loadSettings, loadCollections };
