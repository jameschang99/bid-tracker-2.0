const pad = (n) => String(n).padStart(2, '0');

// Local calendar day of a timestamp -> "YYYY-MM-DD"
export const dateKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const timeStr = (value) => {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// [{key:'2026-10-01', count:3}, ...] newest day first
export const groupCounts = (timestamps) => {
  const map = new Map();
  for (const t of timestamps) {
    const k = dateKey(t);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => (a.key < b.key ? 1 : -1));
};

export const shiftDay = (key, delta) => {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + delta));
};

export const prettyDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};
