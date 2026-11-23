'use strict';
// Visibility is enforced before serialization, never only by the browser.
function isPublic(item) {
  if (!item || item.hidden || item.published === false || item.private === true) return false;
  if (['draft', 'private', 'hidden', 'unpublished', 'archived'].includes(item.status)) return false;
  if (item.access && item.access !== 'public') return false;
  return item.availability !== 'archived';
}
function publicCollections(collections) {
  return Object.fromEntries(Object.entries(collections || {}).map(([key, records]) =>
    [key, Array.isArray(records) ? records.filter(isPublic).map(r => {
      const out={...r};
      if(Array.isArray(r.artifacts))out.artifacts=r.artifacts.filter(a=>a&&a.visibility!=='hidden');
      if(Array.isArray(r.hints))out.hints=r.hints.filter(h=>h.published!==false);
      if(Array.isArray(r.sections))out.sections=r.sections.filter(s=>s.published!==false);
      return out;
    }) : []]));
}
module.exports = { isPublic, publicCollections };
