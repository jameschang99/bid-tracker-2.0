import { useState } from 'react';
import { api, getConfig, saveConfig } from '../api.js';

export default function SettingsDialog({ onClose, onSaved }) {
  const [cfg, setCfg] = useState(getConfig);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    saveConfig({ apiUrl: cfg.apiUrl.trim() });
    onSaved();
  };

  const createPairingCode = async () => {
    setPairingBusy(true);
    setPairingError('');
    try {
      const result = await api.createExtensionCode();
      setPairingCode(result.code);
    } catch (err) {
      setPairingError(err.message);
    } finally {
      setPairingBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Settings</h2>
        <label>
          API URL <small>(leave empty when using the local app)</small>
          <input value={cfg.apiUrl} onChange={set('apiUrl')} placeholder="http://127.0.0.1:4000" autoFocus />
        </label>
        <section className="extension-pairing">
          <h3>Browser extension</h3>
          <p className="muted">Generate a one-time code, then enter it in the extension Options. It expires in five minutes.</p>
          <button type="button" onClick={createPairingCode} disabled={pairingBusy}>
            {pairingBusy ? 'Generating…' : 'Generate pairing code'}
          </button>
          {pairingCode && <output className="pairing-code">{pairingCode}</output>}
          {pairingError && <p className="error">{pairingError}</p>}
        </section>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}
