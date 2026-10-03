const KEY = 'bid_tracker_config';
const SESSION_KEY = 'bid_tracker_session';

export const getConfig = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    if ('apiKey' in stored) {
      delete stored.apiKey;
      localStorage.setItem(KEY, JSON.stringify(stored));
    }
    return { apiUrl: '', ...stored };
  } catch {
    return { apiUrl: '' };
  }
};
export const saveConfig = (cfg) => localStorage.setItem(KEY, JSON.stringify(cfg));
export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};
export const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
export const clearSession = () => localStorage.removeItem(SESSION_KEY);

async function request(path, { method = 'GET', body, token = getSession()?.token } = {}) {
  const { apiUrl } = getConfig();
  const res = await fetch((apiUrl || '').replace(/\/+$/, '') + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || (data.errors || []).join(', ') || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  signup: (username, password) => request('/api/auth/signup', { method: 'POST', body: { username, password }, token: null }),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password }, token: null }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  createExtensionCode: () => request('/api/auth/extension-code', { method: 'POST' }),
  list: () => request('/api/bids?limit=2000'),
  update: (id, patch) => request(`/api/bids/${id}`, { method: 'PATCH', body: patch }),
  remove: (id) => request(`/api/bids/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids) => request('/api/bids/bulk-delete', { method: 'POST', body: { ids } })
};
