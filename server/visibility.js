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
const INVESTIGATION_FIELDS = ['id', 'slug', 'title', 'summary', 'status', 'date', 'tags', 'timeline',
  'findings', 'root_cause', 'analysis', 'lessons_learned', 'evidence', 'links', 'seo_title', 'meta_description'];

function isPublic(item) {
  if (!item || item.hidden || item.published === false || item.private === true) return false;
  if (['draft', 'private', 'hidden', 'unpublished', 'archived'].includes(item.status)) return false;
  if (item.access && item.access !== 'public') return false;
  return item.availability !== 'archived';
}
function isPublicInvestigation(item) {
  return isPublic(item) && item.visibility === 'public';
}
function publicCollections(collections) {
  const out = {};
  for (const key of PUBLIC_KINDS) {
    const records = collections && collections[key];
    if (!Array.isArray(records)) { out[key] = []; continue; }
    if (key === 'investigations') {
      out[key] = records.filter(isPublicInvestigation).map(r => {
        const o = {};
        for (const f of INVESTIGATION_FIELDS) if (r[f] !== undefined) o[f] = r[f];
        return o;
      });
      continue;
    }
    out[key] = records.filter(isPublic).map(r => {
      const o = { ...r };
      if (Array.isArray(r.artifacts)) o.artifacts = r.artifacts.filter(a => a && a.visibility !== 'hidden');
      if (Array.isArray(r.hints)) o.hints = r.hints.filter(h => h.published !== false);
      if (Array.isArray(r.sections)) o.sections = r.sections.filter(s => s.published !== false);
      return o;
    });
  }
  return out;
}
module.exports = { isPublic, isPublicInvestigation, publicCollections, PUBLIC_KINDS };
