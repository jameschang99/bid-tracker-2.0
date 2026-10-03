require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const requireApiKey = require('./middleware/auth');
const bidsRouter = require('./routes/bids');

const { PORT = 4000, MONGODB_URI, API_KEY } = process.env;

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set (see .env.example)');
if (!API_KEY || API_KEY === 'change-me') {
  throw new Error('Set a real API_KEY in .env (see .env.example)');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/bids', requireApiKey, bidsRouter);

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
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => console.log(`API listening on http://0.0.0.0:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
