import { useState, useEffect, useRef } from 'react';

const STATUSES = ['active', 'on-hold', 'completed', 'archived'];

export default function ProjectStatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (newStatus) => {
    setOpen(false);
    if (newStatus !== status) await onChange(newStatus);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={`project-status ${status}`}
        onClick={() => setOpen(prev => !prev)}
        title="Click to change status"
        style={{ cursor: 'pointer', border: 'none', background: 'inherit' }}
      >
        {status}
      </button>

      <div className={`project-status-dropdown ${open ? 'open' : ''}`}>
        {STATUSES.map(s => (
          <button
            key={s}
            className={`project-status-option ${s} ${s === status ? 'current' : ''}`}
            onClick={() => handleSelect(s)}
          >
            {s}
            {s === status && <span className="check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
