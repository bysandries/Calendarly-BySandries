import { useState, useEffect, useRef } from 'react';
import { submitOmniCapture } from '../utils/api';

export default function CaptureModal({ onClose }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [resultsMsg, setResultsMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus('saving');
    try {
      const res = await submitOmniCapture(text);
      if (res.data?.results) {
        setResultsMsg(res.data.results.join(', '));
      } else {
        setResultsMsg('Capture processed');
      }
      setStatus('saved');
      setTimeout(() => onClose(), 2500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: '560px',
          background: 'rgba(15,15,20,0.98)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>
            Omni Capture (Brain Dump)
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="form-input"
            style={{ width: '100%', fontSize: '1.15rem', padding: '14px 18px', marginBottom: '16px', minHeight: '120px', resize: 'vertical' }}
            placeholder="I'm feeling really anxious today. I did a 25 minute pomodoro on my math homework, but I got distracted by Twitter. Also remind me to buy milk tomorrow..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {status === 'saved' && (
            <div style={{ padding: '12px', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              ✓ <strong>Success:</strong> {resultsMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Esc to dismiss</span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'saving' || !text.trim()}
              style={{ minWidth: '100px' }}
            >
              {status === 'saving' ? 'Analyzing...' : status === 'saved' ? '✓ Saved' : status === 'error' ? 'Failed' : 'Collect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
