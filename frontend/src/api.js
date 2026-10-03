const KEY = 'bid_tracker_config';

export const getConfig = () => {
  try {
    return { apiUrl: '', apiKey: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { apiUrl: '', apiKey: '' };
  }
};
export const saveConfig = (cfg) => localStorage.setItem(KEY, JSON.stringify(cfg));

async function request(path, { method = 'GET', body } = {}) {
  const { apiUrl, apiKey } = getConfig();
  const res = await fetch((apiUrl || '').replace(/\/+$/, '') + path, {
    method,
    headers: { 'x-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (data.errors || []).join(', ') || `HTTP ${res.status}`);
  return data;
}

export const api = {
  list: () => request('/api/bids?limit=2000'),
  update: (id, patch) => request(`/api/bids/${id}`, { method: 'PATCH', body: patch }),
  remove: (id) => request(`/api/bids/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids) => request('/api/bids/bulk-delete', { method: 'POST', body: { ids } })
};
