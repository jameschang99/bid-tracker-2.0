// Service worker: talks to the API (content scripts never hold the API key).
const DEFAULTS = { apiUrl: 'http://localhost:4000', apiKey: '' };

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { apiUrl: cfg.apiUrl.replace(/\/+$/, ''), apiKey: cfg.apiKey };
}

async function api(path, options = {}) {
  const { apiUrl, apiKey } = await getConfig();
  if (!apiKey) throw new Error('API key not set. Open the extension Options page.');
  const res = await fetch(apiUrl + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (data.errors || []).join(', ') || `HTTP ${res.status}`);
  return data;
}

async function flushPending() {
  const { pending = [] } = await chrome.storage.local.get('pending');
  if (!pending.length) return;
  const { username = '' } = await chrome.storage.sync.get({ username: '' });
  const still = [];
  for (const p of pending) {
    try {
      await api('/api/bids', { method: 'POST', body: JSON.stringify({ ...p, username: p.username || username }) });
    } catch {
      still.push(p);
    }
  }
  await chrome.storage.local.set({ pending: still });
}

async function saveBid(payload) {
  const { username = '' } = await chrome.storage.sync.get({ username: '' });
  const bid = { ...payload, username };
  try {
    const data = await api('/api/bids', { method: 'POST', body: JSON.stringify(bid) });
    flushPending();
    return { ok: true, bid: data.bid };
  } catch (err) {
    // Keep it locally and retry later (server down, offline, etc.)
    const { pending = [] } = await chrome.storage.local.get('pending');
    pending.push(bid);
    await chrome.storage.local.set({ pending: pending.slice(-100) });
    return { ok: false, queued: true, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVE_BID') {
    saveBid(msg.payload).then(sendResponse);
    return true;
  }
  if (msg.type === 'LIST_BIDS') {
    api('/api/bids?limit=10')
      .then((d) => sendResponse({ ok: true, bids: d.bids }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

chrome.runtime.onStartup.addListener(flushPending);
chrome.runtime.onInstalled.addListener(flushPending);
