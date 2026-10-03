const crypto = require('crypto');

module.exports = function requireApiKey(req, res, next) {
  const provided = Buffer.from(String(req.get('x-api-key') || ''));
  const expected = Buffer.from(String(process.env.API_KEY || ''));
  const ok =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid API key' });
  next();
};
