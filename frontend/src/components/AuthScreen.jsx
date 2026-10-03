import { useState } from 'react';

export default function AuthScreen({ onAuthenticated, notice = '' }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onAuthenticated(mode, username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="brand-kicker">FIELD OFFICE · 01</p>
        <h1>Bid Tracker</h1>
        <p className="auth-intro">Sign in to your private bid workspace.</p>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {notice && <p className="error">{notice}</p>}
          <label>
            Username
            <input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]{3,32}" />
          </label>
          <label>
            Password
            <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'signup' ? 10 : 1} maxLength={128} />
          </label>
          {mode === 'signup' && <p className="muted">Username: 3-32 letters, numbers, dots, underscores, or hyphens. Password: at least 10 characters.</p>}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
        </form>
      </section>
    </main>
  );
}