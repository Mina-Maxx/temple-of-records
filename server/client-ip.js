'use strict';

function clientIp(req, trustProxy) {
  const raw = (req && req.socket && req.socket.remoteAddress) || 'unknown';
  if (trustProxy) {
    const headers = (req && req.headers) || {};
    const xReal = String(headers['x-real-ip'] || '').trim();
    if (/^[0-9a-fA-F:.]{3,45}$/.test(xReal)) return xReal;
    const xff = String(headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const last = xff.length ? xff[xff.length - 1] : '';
    if (/^[0-9a-fA-F:.]{3,45}$/.test(last)) return last;
  }
  return raw;
}

module.exports = { clientIp };
