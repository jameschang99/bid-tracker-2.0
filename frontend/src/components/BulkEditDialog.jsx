import { useState } from 'react';

const TEXT_FIELDS = [
  ['companyName', 'Company'],
  ['location', 'Location'],
  ['locationType', 'Location type'],
  ['employmentType', 'Employment type'],
  ['salary', 'Salary']
];

export default function BulkEditDialog({ count, onSave, onClose }) {
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({ workMethod: 'unknown' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (key) => (event) => setEnabled((current) => ({ ...current, [key]: event.target.checked }));
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const patch = Object.fromEntries(Object.entries(enabled).filter(([, apply]) => apply).map(([key]) => [key, values[key] ?? '']));
    if (!Object.keys(patch).length) {
      setError('Select at least one field to update.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(patch);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog wide" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Edit {count} selected bids</h2>
        <p className="muted">Check each field you want to apply. Empty text clears that field.</p>
        <div className="bulk-edit-fields">
          {TEXT_FIELDS.map(([key, label]) => (
            <label className="bulk-edit-field" key={key}>
              <span><input type="checkbox" checked={Boolean(enabled[key])} onChange={toggle(key)} /> {label}</span>
              {key === 'salary' ? (
                <textarea rows={3} value={values[key] || ''} onChange={set(key)} disabled={!enabled[key]} />
              ) : (
                <input value={values[key] || ''} onChange={set(key)} disabled={!enabled[key]} />
              )}
            </label>
          ))}
          <label className="bulk-edit-field">
            <span><input type="checkbox" checked={Boolean(enabled.workMethod)} onChange={toggle('workMethod')} /> Salary Method</span>
            <select value={values.workMethod} onChange={set('workMethod')} disabled={!enabled.workMethod}>
              <option value="unknown">unknown</option>
              <option value="hourly">hourly</option>
              <option value="fixed">fixed</option>
            </select>
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Updating…' : 'Update selected'}</button>
        </div>
      </form>
    </div>
  );
}