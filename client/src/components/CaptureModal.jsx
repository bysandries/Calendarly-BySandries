import { useState, useEffect, useRef } from 'react';
import { createTask as apiCreateTask } from '../utils/api/tasks';
import { createProject as apiCreateProject } from '../utils/api/projects';
import { syncEventBlock } from '../utils/api/events';
import { DateTime } from 'luxon';

const TYPES = ['task', 'project', 'event'];

export default function CaptureModal({ onClose }) {
  const [title, setTitle] = useState('');
  const [captureType, setCaptureType] = useState('task');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
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
    if (!title.trim()) return;
    setStatus('saving');
    try {
      if (captureType === 'task') {
        await apiCreateTask({ title, status: '01 - Inbox' });
      } else if (captureType === 'project') {
        await apiCreateProject({
          title,
          status: 'on-hold',
          area: 'general',
          pillar: 'Innovation',
          phase: 'Plan',
          methodology: 'PALM',
          description: 'Captured via Quick Capture',
        });
      } else if (captureType === 'event') {
        const now = DateTime.now();
        const dateStr = now.toISODate();
        const timeStr = now.toFormat('HH:00');
        await syncEventBlock({
          title,
          date_string: dateStr,
          time_slot: timeStr,
          duration_mins: 60,
          column_type: 'plan',
          area: 'general',
          color_hex: '#95A5A6',
          notes: 'Captured via Quick Capture',
          block_signature: `${dateStr}_${timeStr}_plan_${Date.now()}`,
        });
      }
      setStatus('saved');
      setTimeout(() => onClose(), 600);
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
            Quick Capture
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Type Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setCaptureType(t)}
              style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', textTransform: 'capitalize',
                border: `1px solid ${captureType === t ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
                background: captureType === t ? 'rgba(52,152,219,0.15)' : 'transparent',
                color: captureType === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="form-input"
            style={{ width: '100%', fontSize: '1.15rem', padding: '14px 18px', marginBottom: '16px' }}
            placeholder={`Capture ${captureType}...`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Esc to dismiss</span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'saving' || !title.trim()}
              style={{ minWidth: '100px' }}
            >
              {status === 'saving' ? 'Saving...' : status === 'saved' ? '✓ Saved' : status === 'error' ? 'Failed' : 'Collect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
