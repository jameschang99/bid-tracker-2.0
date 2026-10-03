const crypto = require('crypto');
const AuthSession = require('../models/AuthSession');

async function requireSession(req, res, next) {
  try {
    const authorization = String(req.get('authorization') || '');
    const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{40,})$/i);
    if (!match) return res.status(401).json({ ok: false, error: 'Authentication required' });
    const tokenHash = crypto.createHash('sha256').update(match[1]).digest('hex');
    const session = await AuthSession.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).populate('userId', 'username');
    if (!session || !session.userId) return res.status(401).json({ ok: false, error: 'Session expired; sign in again' });
    req.authUser = session.userId;
    req.authTokenHash = tokenHash;
    next();
  } catch (err) {
    next(err);
  }
}

function requireApiKey(req, res, next) {
  const authorization = String(req.get('authorization') || '');
  if (/^Bearer\s+/i.test(authorization)) return requireSession(req, res, next);
  const provided = Buffer.from(String(req.get('x-api-key') || ''));
  const expected = Buffer.from(String(process.env.API_KEY || ''));
  const ok =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid API key' });
  req.authUser = null;
  next();
}

module.exports = requireApiKey;
module.exports.requireSession = requireSession;
