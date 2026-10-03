require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const requireAuth = require('./middleware/requireAuth');
const authRouter = require('./routes/auth');
const bidsRouter = require('./routes/bids');
const Bid = require('./models/Bid');
const User = require('./models/User');

async function getCollectionIndexes(model) {
  try {
    return await model.collection.indexes();
  } catch (err) {
    if (err.code === 26 || err.codeName === 'NamespaceNotFound') return [];
    throw err;
  }
}

const { PORT = 4000, MONGODB_URI } = process.env;

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set (see .env.example)');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/bids', requireAuth, bidsRouter);

// Serve the React app if it has been built (frontend/dist)
const dist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    const indexes = await getCollectionIndexes(Bid);
    const legacyIndex = indexes.find((index) => index.name === 'platform_1_jobUrl_1');
    if (legacyIndex) await Bid.collection.dropIndex(legacyIndex.name);
    await Bid.collection.createIndex({ userId: 1, platform: 1, jobUrl: 1 }, { unique: true });
    const userIndexes = await getCollectionIndexes(User);
    const legacyEmailIndex = userIndexes.find((index) => index.name === 'email_1');
    if (legacyEmailIndex) {
      const legacyAccounts = await User.collection.countDocuments({ email: { $exists: true } });
      if (legacyAccounts) throw new Error('Email-based accounts need migration before username login can start');
      await User.collection.dropIndex(legacyEmailIndex.name);
    }
    await User.collection.createIndex({ username: 1 }, { unique: true });
    app.listen(PORT, '127.0.0.1', () => console.log(`API listening on http://127.0.0.1:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
