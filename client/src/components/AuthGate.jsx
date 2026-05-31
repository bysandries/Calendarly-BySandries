import { useState, useEffect } from 'react';
import { getApiToken, setApiToken } from '../utils/api/core';

/**
 * Blocks the app until a valid API token is present. The token is kept only in
 * localStorage on this device — it is never bundled into the build, so loading
 * the page does not hand out access. A 401 from any request clears the token
 * (see core.js) and brings this gate back.
 */
export default function AuthGate({ children }) {
  const [authed, setAuthed] = useState(() => Boolean(getApiToken()));
  const [value, setValue] = useState('');

  useEffect(() => {
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener('calendarly:unauthorized', onUnauthorized);
    return () => window.removeEventListener('calendarly:unauthorized', onUnauthorized);
  }, []);

  if (authed) return children;

  const submit = (e) => {
    e.preventDefault();
    const token = value.trim();
    if (!token) return;
    setApiToken(token);
    setValue('');
    setAuthed(true);
  };

  return (
    <div style={styles.overlay}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={styles.title}>Calendarly</h1>
        <p style={styles.subtitle}>Enter your access token to continue.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Access token"
          style={styles.input}
          aria-label="Access token"
        />
        <button type="submit" style={styles.button}>Unlock</button>
        <p style={styles.hint}>
          This is the <code>API_AUTH_TOKEN</code> configured on the server.
        </p>
      </form>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f1115', zIndex: 9999,
  },
  card: {
    display: 'flex', flexDirection: 'column', gap: '12px', width: '320px',
    padding: '32px', borderRadius: '16px', background: '#1a1d24',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)', color: '#e6e8eb',
    fontFamily: 'system-ui, sans-serif',
  },
  title: { margin: 0, fontSize: '22px', fontWeight: 700 },
  subtitle: { margin: 0, fontSize: '14px', opacity: 0.7 },
  input: {
    padding: '12px 14px', borderRadius: '10px', border: '1px solid #2c313a',
    background: '#0f1115', color: '#e6e8eb', fontSize: '14px', outline: 'none',
  },
  button: {
    padding: '12px 14px', borderRadius: '10px', border: 'none',
    background: '#4f7cff', color: '#fff', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer',
  },
  hint: { margin: 0, fontSize: '12px', opacity: 0.5 },
};
