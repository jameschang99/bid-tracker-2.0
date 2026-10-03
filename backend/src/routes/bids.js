const express = require('express');
const mongoose = require('mongoose');
const Bid = require('../models/Bid');
const { enrichJobFields } = require('../services/ai');

const router = express.Router();
const WORK_METHODS = ['hourly', 'fixed', 'unknown'];
const TEXT_FIELDS = {
  username: 100, jobTitle: 300, companyName: 200, location: 200, locationType: 60,
  employmentType: 60, salary: 20000, workContent: 20000
};
const str = (v, max) => (v === null || v === undefined ? '' : String(v).trim().slice(0, max));

function cleanUrl(u) {
  try {
    const url = new URL(u);
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// Save (or update) an entry — called by the extension on Ctrl+.
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const jobUrl = cleanUrl(b.jobUrl);
    const errors = [];
    if (!b.platform || typeof b.platform !== 'string') errors.push('platform is required');
    if (!b.jobTitle || typeof b.jobTitle !== 'string') errors.push('jobTitle is required');
    if (!jobUrl) errors.push('jobUrl must be a valid URL');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const doc = { platform: b.platform.toLowerCase().trim(), jobUrl };
    for (const [k, max] of Object.entries(TEXT_FIELDS)) doc[k] = str(b[k], max);
    doc.companyName = doc.companyName || 'Not disclosed';
    doc.workMethod = WORK_METHODS.includes(b.workMethod) ? b.workMethod : 'unknown';
    const enrichment = await enrichJobFields(doc);
    Object.assign(doc, enrichment.fields);

    const saved = await Bid.findOneAndUpdate(
      { platform: doc.platform, jobUrl },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ ok: true, bid: saved, aiEnhanced: enrichment.used });
  } catch (err) {
    next(err);
  }
});

// List entries, newest first: GET /api/bids?limit=500&platform=ashby
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
    const filter = req.query.platform ? { platform: String(req.query.platform).toLowerCase() } : {};
    const bids = await Bid.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ ok: true, count: bids.length, bids });
  } catch (err) {
    next(err);
  }
});

// Delete many: POST /api/bids/bulk-delete {ids:[...]}
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter((i) => mongoose.isValidObjectId(i)) : [];
    if (!ids.length || ids.length > 1000) return res.status(400).json({ ok: false, error: 'ids must be 1-1000 valid ids' });
    const r = await Bid.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (err) {
    next(err);
  }
});

// Modify one entry
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, error: 'Invalid id' });
    const b = req.body || {};
    const set = {};
    for (const [k, max] of Object.entries(TEXT_FIELDS)) if (k in b) set[k] = str(b[k], max);
    if ('bidSent' in b) {
      if (typeof b.bidSent !== 'boolean') return res.status(400).json({ ok: false, error: 'bidSent must be a boolean' });
      set.bidSent = b.bidSent;
    }
    if ('jobUrl' in b) {
      const jobUrl = cleanUrl(b.jobUrl);
      if (!jobUrl) return res.status(400).json({ ok: false, error: 'jobUrl must be a valid URL' });
      set.jobUrl = jobUrl;
    }
    if ('workMethod' in b) {
      if (!WORK_METHODS.includes(b.workMethod)) return res.status(400).json({ ok: false, error: 'Invalid workMethod' });
      set.workMethod = b.workMethod;
    }
    if ('jobTitle' in set && !set.jobTitle) return res.status(400).json({ ok: false, error: 'jobTitle cannot be empty' });
    if (!Object.keys(set).length) return res.status(400).json({ ok: false, error: 'Nothing to update' });
    const bid = await Bid.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true });
    if (!bid) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, bid });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, error: 'Invalid id' });
    const r = await Bid.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
