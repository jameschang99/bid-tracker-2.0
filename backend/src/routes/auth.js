const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const ExtensionPairing = require('../models/ExtensionPairing');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 30;
const PAIRING_MINUTES = 5;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

async function issueSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await AuthSession.create({ userId: user._id, tokenHash, expiresAt });
  return { token, expiresAt, user: { id: String(user._id), username: user.username } };
}

router.post('/signup', async (req, res, next) => {
  try {
    const username = String(req.body && req.body.username || '').trim().toLowerCase();
    const password = String(req.body && req.body.password || '');
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({ ok: false, error: 'Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens' });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ ok: false, error: 'Password must be 10 to 128 characters' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    let user;
    try {
      user = await User.create({ username, passwordHash: `${salt}:${hash.toString('hex')}` });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ ok: false, error: 'That username is already taken' });
      throw err;
    }

    res.status(201).json({ ok: true, ...(await issueSession(user)) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body && req.body.username || '').trim().toLowerCase();
    const password = String(req.body && req.body.password || '');
    const user = await User.findOne({ username }).select('+passwordHash');
    if (!user || password.length > 128) return res.status(401).json({ ok: false, error: 'Username or password is incorrect' });

    const [salt, storedHex] = String(user.passwordHash).split(':');
    const stored = Buffer.from(storedHex || '', 'hex');
    const candidate = await scrypt(password, salt, 64);
    if (stored.length !== candidate.length || !crypto.timingSafeEqual(stored, candidate)) {
      return res.status(401).json({ ok: false, error: 'Username or password is incorrect' });
    }

    res.json({ ok: true, ...(await issueSession(user)) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: { id: String(req.user._id), username: req.user.username } });
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await AuthSession.deleteOne({ tokenHash: req.authTokenHash });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/extension-code', requireAuth, async (req, res, next) => {
  try {
    await ExtensionPairing.deleteMany({ userId: req.user._id });
    const code = crypto.randomInt(0, 10000000000).toString().padStart(10, '0');
    const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60 * 1000);
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    await ExtensionPairing.create({ userId: req.user._id, codeHash, expiresAt });
    res.json({ ok: true, code, expiresAt });
  } catch (err) {
    next(err);
  }
});

router.post('/extension-session', async (req, res, next) => {
  try {
    const code = String(req.body && req.body.code || '').trim();
    if (!/^\d{10}$/.test(code)) return res.status(400).json({ ok: false, error: 'Enter the 10-digit pairing code' });
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const pairing = await ExtensionPairing.findOneAndDelete({ codeHash, expiresAt: { $gt: new Date() } });
    if (!pairing) return res.status(401).json({ ok: false, error: 'Pairing code is invalid, expired, or already used' });
    const user = await User.findById(pairing.userId);
    if (!user) return res.status(401).json({ ok: false, error: 'Account no longer exists' });
    res.json({ ok: true, ...(await issueSession(user)) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;