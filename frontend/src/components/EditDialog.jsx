import { useState } from 'react';
import { salaryMethod } from '../lib/salary.js';

const FIELDS = [
  ['jobTitle', 'Job title'],
  ['jobUrl', 'Job URL'],
  ['companyName', 'Company'],
  ['location', 'Location'],
  ['locationType', 'Location type'],
  ['employmentType', 'Employment type'],
  ['salary', 'Salary (exactly as on the page)'],
];

export default function EditDialog({ bid, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(FIELDS.map(([k]) => [k, bid[k] ?? ''])),
    bidSent: Boolean(bid.bidSent),
    workMethod: salaryMethod(bid.workMethod),
    workContent: bid.workContent || ''
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await onSave(form); // parent closes the dialog on success
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog wide" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Edit entry</h2>
        <div className="grid">
          {FIELDS.map(([k, label]) => (
            <label key={k}>
              {label}
              {k === 'salary' ? (
                <textarea rows={4} value={form[k]} onChange={set(k)} />
              ) : (
                <input
                  type={k === 'jobUrl' ? 'url' : 'text'}
                  value={form[k]}
                  onChange={set(k)}
                  required={k === 'jobTitle' || k === 'jobUrl'}
                />
              )}
            </label>
          ))}
          <label>
            Salary Method
            <select value={form.workMethod} onChange={set('workMethod')}>
              <option value="unknown">unknown</option>
              <option value="hourly">hourly</option>
              <option value="fixed">fixed</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.bidSent}
              onChange={(event) => setForm((current) => ({ ...current, bidSent: event.target.checked }))}
            />
            Bid sent
          </label>
        </div>
        <label>
          Work content
          <textarea rows={10} value={form.workContent} onChange={set('workContent')} />
        </label>
        <p className="muted">
          Source: <a href={bid.jobUrl} target="_blank" rel="noreferrer">{bid.jobUrl}</a>
        </p>
        {err && <p className="error">{err}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
