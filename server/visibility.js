'use strict';
// Visibility is enforced before serialization, never only by the browser.
//
// Only the collections listed in PUBLIC_KINDS can ever reach the public site.
// kb / projects / categories / tags are admin-only and are NEVER serialized,
// whatever their "status" says (v7 leaked them into /content.js).
const PUBLIC_KINDS = ['challenges', 'articles', 'investigations'];

// Investigations are opt-in: they need visibility === 'public' AND must pass
// isPublic() (not draft/hidden). Only these fields are ever published, so an
// extra private field added later can never leak by accident.
const INVESTIGATION_FIELDS = [
  'id', 'slug', 'title', 'summary', 'status', 'date', 'tags', 'attack',
  'evidence', 'timeline', 'analysis', 'findings', 'root_cause',
  'use_case', 'detection_engineering', 'detection_rule_lang', 'detection_rule',
  'lessons_learned', 'links', 'seo_title', 'meta_description'
];

function isPublic(item, now = Date.now()) {
  if (!item || item.hidden || item.published === false || item.private === true) return false;
  if (item.sample === true && process.env.TOR_SHOW_SAMPLES !== '1') return false;
  if (['draft', 'private', 'hidden', 'unpublished', 'archived'].includes(item.status)) return false;
  if (item.access && item.access !== 'public') return false;
  if (item.publish_at) {
    const t = Date.parse(item.publish_at);
    if (Number.isFinite(t) && t > now) return false;
  }
  return item.availability !== 'archived';
}
function isPublicInvestigation(item, now = Date.now()) {
  return isPublic(item, now) && item.visibility === 'public';
}
function publicCollections(collections, now = Date.now()) {
  const out = {};
  for (const key of PUBLIC_KINDS) {
    const records = collections && collections[key];
    if (!Array.isArray(records)) { out[key] = []; continue; }
    if (key === 'investigations') {
      out[key] = records.filter(r => isPublicInvestigation(r, now)).map(r => {
        const o = {};
        for (const f of INVESTIGATION_FIELDS) if (r[f] !== undefined) o[f] = r[f];
        return o;
      });
      continue;
    }
    out[key] = records.filter(r => isPublic(r, now)).map(r => {
      const o = { ...r };
      if (key === 'challenges') delete o.points;
      if (Array.isArray(r.artifacts)) o.artifacts = r.artifacts.filter(a => a && a.visibility !== 'hidden');
      if (Array.isArray(r.hints)) o.hints = r.hints.filter(h => h.published !== false).map(h => ({ ar: h.ar || '', en: h.en || '', published: h.published }));
      if (Array.isArray(r.sections)) {
        const gateSol = key === 'challenges' && process.env.TOR_GATE_SOLUTIONS === '1' && r.solution_public !== true;
        o.sections = r.sections.filter(s => s.published !== false && (!gateSol || s.zone !== 'solution'));
      }
      return o;
    });
  }
  return out;
}
module.exports = { isPublic, isPublicInvestigation, publicCollections, PUBLIC_KINDS };
