import { useState } from 'react';
import { getConfig, saveConfig } from '../api.js';

export default function SettingsDialog({ onClose, onSaved }) {
  const [cfg, setCfg] = useState(getConfig);
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    saveConfig({ apiUrl: cfg.apiUrl.trim(), apiKey: cfg.apiKey.trim() });
    onSaved();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Settings</h2>
        <label>
          API key
          <input type="password" value={cfg.apiKey} onChange={set('apiKey')} placeholder="API_KEY from backend/.env" autoFocus />
        </label>
        <label>
          API URL <small>(leave empty when the app is served by the backend or the Vite dev server)</small>
          <input value={cfg.apiUrl} onChange={set('apiUrl')} placeholder="https://api.example.com" />
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}
