import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getConfig } from './api.js';
import { dateKey, timeStr, groupCounts, shiftDay, prettyDay } from './lib/days.js';
import { toCsv, downloadCsv } from './lib/csv.js';
import { salaryMethod, salaryValue } from './lib/salary.js';
import EditDialog from './components/EditDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';

const todayKey = () => dateKey(new Date());

export default function App() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [day, setDay] = useState(null); // null until first load; then 'all' or 'YYYY-MM-DD'
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const [selected, setSelected] = useState(() => new Set());
  const [updatingSent, setUpdatingSent] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [showSettings, setShowSettings] = useState(() => !getConfig().apiKey);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { bids: list } = await api.list();
      setBids(list);
      setDay((d) => d ?? (list.length ? dateKey(list[0].createdAt) : todayKey()));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getConfig().apiKey) load();
  }, [load]);

  const days = useMemo(() => groupCounts(bids.map((b) => b.createdAt)), [bids]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = bids.filter((b) => {
      if (day && day !== 'all' && dateKey(b.createdAt) !== day) return false;
      if (!q) return true;
      return [b.username, b.jobTitle, b.jobUrl, b.companyName, b.platform, b.location, b.locationType, b.employmentType, b.salary, salaryMethod(b.workMethod), b.bidSent ? 'sent' : 'not sent']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    if (!sort.key) return filtered;

    const value = (bid) => {
      switch (sort.key) {
        case 'time': return new Date(bid.createdAt).getTime();
        case 'username': return bid.username;
        case 'platform': return bid.platform;
        case 'jobTitle': return bid.jobTitle;
        case 'jobUrl': return bid.jobUrl;
        case 'companyName': return bid.companyName;
        case 'location': return bid.location;
        case 'locationType': return bid.locationType;
        case 'employmentType': return bid.employmentType;
        case 'salary': return salaryValue(bid.salary);
        case 'salaryMethod': return salaryMethod(bid.workMethod);
        case 'bidSent': return bid.bidSent ? 1 : 0;
        default: return '';
      }
    };
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = value(a) ?? '';
      const right = value(b) ?? '';
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return result * direction;
    });
  }, [bids, day, query, sort]);

  // Drop selections that are no longer displayed
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(shown.map((b) => b._id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shown]);

  const allChecked = shown.length > 0 && shown.every((b) => selected.has(b._id));
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(shown.map((b) => b._id)));
  const sortableHeader = (label, key) => {
    const active = sort.key === key;
    return (
      <th key={key} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className="sort-header"
          onClick={() => setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
          }))}
        >
          {label}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
        </button>
      </th>
    );
  };

  const exportCsv = () => {
    const rows = selected.size ? shown.filter((b) => selected.has(b._id)) : shown;
    downloadCsv(`bids-${day === 'all' ? 'all-days' : day}.csv`, toCsv(rows));
  };

  const deleteIds = async (ids) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
    try {
      if (ids.length === 1) await api.remove(ids[0]);
      else await api.bulkDelete(ids);
      const gone = new Set(ids);
      setBids((bs) => bs.filter((b) => !gone.has(b._id)));
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    }
  };

  const saveEdit = async (patch) => {
    const { bid } = await api.update(editing._id, patch);
    setBids((bs) => bs.map((b) => (b._id === bid._id ? bid : b)));
    setEditing(null);
  };

  const toggleBidSent = async (bid) => {
    setUpdatingSent((current) => new Set(current).add(bid._id));
    try {
      const { bid: updated } = await api.update(bid._id, { bidSent: !Boolean(bid.bidSent) });
      setBids((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingSent((current) => {
        const next = new Set(current);
        next.delete(bid._id);
        return next;
      });
    }
  };

  return (
    <div className="app">
      <header>
        <div className="brand-lockup">
          <p className="brand-kicker">FIELD OFFICE · 01</p>
          <h1>Bid Tracker</h1>
        </div>
        <div className="header-actions">
          <button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}

      <div className="layout">
        <aside>
          <button className={`day-item ${day === 'all' ? 'active' : ''}`} onClick={() => setDay('all')}>
            <span>All days</span>
            <span className="count">{bids.length}</span>
          </button>
          {days.map((d) => (
            <button key={d.key} className={`day-item ${day === d.key ? 'active' : ''}`} onClick={() => setDay(d.key)}>
              <span>{prettyDay(d.key)}</span>
              <span className="count">{d.count}</span>
            </button>
          ))}
        </aside>

        <main>
          <div className="toolbar">
            <div className="day-nav">
              <button disabled={!day || day === 'all'} onClick={() => setDay(shiftDay(day, -1))} title="Previous day">◀</button>
              <input
                type="date"
                value={day && day !== 'all' ? day : ''}
                onChange={(e) => setDay(e.target.value || 'all')}
              />
              <button disabled={!day || day === 'all'} onClick={() => setDay(shiftDay(day, 1))} title="Next day">▶</button>
              <button onClick={() => setDay(todayKey())}>Today</button>
            </div>
            <input
              className="search"
              placeholder="Search title, company, salary…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="spacer" />
            <button onClick={exportCsv} disabled={!shown.length}>
              {selected.size ? `Export selected (${selected.size}) CSV` : 'Export CSV'}
            </button>
            <button className="danger" onClick={() => deleteIds([...selected])} disabled={!selected.size}>
              Delete selected ({selected.size})
            </button>
          </div>

          <p className="muted">
            {day === 'all' ? 'All days' : day ? prettyDay(day) : ''} · {shown.length} entr{shown.length === 1 ? 'y' : 'ies'}
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
                  {sortableHeader('Time', 'time')}
                  {sortableHeader('Bid sent', 'bidSent')}
                  {sortableHeader('Username', 'username')}
                  {sortableHeader('Platform', 'platform')}
                  {sortableHeader('Job title', 'jobTitle')}
                  {sortableHeader('Job URL', 'jobUrl')}
                  {sortableHeader('Company', 'companyName')}
                  {sortableHeader('Location', 'location')}
                  {sortableHeader('Location type', 'locationType')}
                  {sortableHeader('Employment type', 'employmentType')}
                  {sortableHeader('Salary', 'salary')}
                  {sortableHeader('Salary Method', 'salaryMethod')}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b._id} className={selected.has(b._id) ? 'selected' : ''}>
                    <td><input type="checkbox" checked={selected.has(b._id)} onChange={() => toggle(b._id)} /></td>
                    <td>{day === 'all' ? `${dateKey(b.createdAt)} ${timeStr(b.createdAt)}` : timeStr(b.createdAt)}</td>
                    <td>
                      <label className="sent-control">
                        <input
                          type="checkbox"
                          checked={Boolean(b.bidSent)}
                          disabled={updatingSent.has(b._id)}
                          onChange={() => toggleBidSent(b)}
                          aria-label={b.bidSent ? 'Mark bid as not sent' : 'Mark bid as sent'}
                        />
                        <span>{b.bidSent ? 'Sent' : 'Not sent'}</span>
                      </label>
                    </td>
                    <td>{b.username}</td>
                    <td>{b.platform}</td>
                    <td className="clip" title={b.jobTitle}>
                      <a href={b.jobUrl} target="_blank" rel="noreferrer">{b.jobTitle}</a>
                    </td>
                    <td className="clip" title={b.jobUrl}>
                      <a href={b.jobUrl} target="_blank" rel="noreferrer">{b.jobUrl}</a>
                    </td>
                    <td>{b.companyName}</td>
                    <td>{b.location}</td>
                    <td>{b.locationType}</td>
                    <td>{b.employmentType}</td>
                    <td className="salary-cell" title={b.salary}>
                      <span className="salary-preview">{salaryValue(b.salary)}</span>
                    </td>
                    <td>{salaryMethod(b.workMethod)}</td>
                    <td className="row-actions">
                      <button onClick={() => setEditing(b)}>Edit</button>
                      <button className="danger" onClick={() => deleteIds([b._id])}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={14} className="empty">
                      {loading ? 'Loading…' : 'Nothing here. Press Ctrl + . on a job page to save one, or pick another day.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {editing && <EditDialog bid={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            load();
          }}
        />
      )}
    </div>
  );
}
