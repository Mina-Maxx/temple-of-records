'use strict';

const PLACEHOLDER_MARKERS = [
  'to be added',
  'تُضاف لاحقًا',
  'يُضاف لاحقًا',
  'تُضافان لاحقًا',
  'يُضافان لاحقًا',
  'placeholder',
  'fabricated',
  'أماكن مؤقتة'
];

function isPlaceholder(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  const low = str.toLowerCase();
  return PLACEHOLDER_MARKERS.some(m => low.includes(m.toLowerCase()));
}

module.exports = { PLACEHOLDER_MARKERS, isPlaceholder };
