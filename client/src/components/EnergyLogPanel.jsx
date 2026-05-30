import { useState, useEffect, useCallback } from 'react';
import { fetchEnergyLogs, createEnergyLog, deleteEnergyLog } from '../utils/api/activityEnergyLog';

// Quadrant definitions — energy_level + emotion_type → display metadata
const QUADRANTS = [
  { energy: 'high', emotion: 'positive', label: 'Performance',  sub: 'High energy · Positive',  color: '#2ECC71', bg: '#2ECC7118' },
  { energy: 'high', emotion: 'negative', label: 'Survival',     sub: 'High energy · Negative',  color: '#3498DB', bg: '#3498DB18' },
  { energy: 'low',  emotion: 'positive', label: 'Renewal',      sub: 'Low energy · Positive',   color: '#F1C40F', bg: '#F1C40F18' },
  { energy: 'low',  emotion: 'negative', label: 'Burnout',      sub: 'Low energy · Negative',   color: '#E74C3C', bg: '#E74C3C18' },
];

function quadrantMeta(energy, emotion) {
  return QUADRANTS.find(q => q.energy === energy && q.emotion === emotion) || QUADRANTS[0];
}

function fmtLoggedAt(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EnergyLogPanel({ entityType, entityId }) {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [selected, setSelected] = useState(null); // { energy, emotion }
  const [note, setNote]         = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    if (!entityId) return;
    setLoading(true);
    fetchEnergyLogs({ entity_type: entityType, entity_id: String(entityId) })
      .then(data => { setLogs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  async function handleLog() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const entry = await createEnergyLog({
        entity_type:  entityType,
        entity_id:    String(entityId),
        energy_level: selected.energy,
        emotion_type: selected.emotion,
        note:         note.trim() || undefined,
      });
      setLogs(prev => [entry, ...prev]);
      setSelected(null);
      setNote('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteEnergyLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (_) {}
  }

  const latest = logs[0];
  const latestMeta = latest ? quadrantMeta(latest.energy_level, latest.emotion_type) : null;

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.06em', color: 'var(--text-dimmed)',
          }}>
            Energy Log
          </span>
          {latestMeta && !expanded && (
            <span style={{
              fontSize: '11px', fontWeight: 600, color: latestMeta.color,
              background: latestMeta.bg, borderRadius: '4px', padding: '1px 7px',
            }}>
              {latestMeta.label}
            </span>
          )}
          {logs.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>
              {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '11px', color: 'var(--text-dimmed)', padding: '0',
          }}
        >
          {expanded ? 'Collapse ▲' : 'Log ▼'}
        </button>
      </div>

      {expanded && (
        <>
          {/* 2×2 quadrant picker */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
            marginBottom: '10px',
          }}>
            {QUADRANTS.map(q => {
              const isSelected = selected?.energy === q.energy && selected?.emotion === q.emotion;
              return (
                <button
                  key={`${q.energy}-${q.emotion}`}
                  onClick={() => setSelected(isSelected ? null : { energy: q.energy, emotion: q.emotion })}
                  style={{
                    background:   isSelected ? q.bg : 'var(--surface-2)',
                    border:       `1px solid ${isSelected ? q.color : 'var(--border)'}`,
                    borderRadius: '6px',
                    padding:      '8px 10px',
                    textAlign:    'left',
                    cursor:       'pointer',
                    transition:   'border-color .1s, background .1s',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? q.color : 'var(--text-primary)' }}>
                    {q.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                    {q.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Axis labels beneath picker */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '10px', color: 'var(--text-dimmed)', marginBottom: '10px',
            paddingLeft: '2px', paddingRight: '2px',
          }}>
            <span>← Negative emotion</span>
            <span>Positive emotion →</span>
          </div>

          {/* Note input + log button */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <input
              placeholder="Optional note…"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLog()}
              disabled={!selected}
              style={{
                flex: 1,
                background:   'var(--surface-2)',
                border:       `1px solid ${selected ? (quadrantMeta(selected.energy, selected.emotion).color + '88') : 'var(--border)'}`,
                borderRadius: '5px',
                padding:      '5px 10px',
                fontSize:     '12px',
                color:        'var(--text-primary)',
                opacity:      selected ? 1 : 0.5,
              }}
            />
            <button
              onClick={handleLog}
              disabled={!selected || saving}
              style={{
                background:   selected ? quadrantMeta(selected.energy, selected.emotion).color : 'var(--surface-3)',
                color:        selected ? '#fff' : 'var(--text-dimmed)',
                border:       'none',
                borderRadius: '5px',
                padding:      '5px 14px',
                fontSize:     '12px',
                fontWeight:   600,
                cursor:       selected ? 'pointer' : 'default',
                opacity:      saving ? 0.6 : 1,
                transition:   'background .1s',
                whiteSpace:   'nowrap',
              }}
            >
              Log
            </button>
          </div>

          {/* History */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '5px' }} />)}
            </div>
          ) : logs.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-dimmed)', margin: 0 }}>
              No entries yet — pick a quadrant and log it.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {logs.map(log => {
                const meta = quadrantMeta(log.energy_level, log.emotion_type);
                return (
                  <div key={log.id} style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                    background:   'var(--surface-2)',
                    border:       '1px solid var(--border)',
                    borderLeft:   `3px solid ${meta.color}`,
                    borderRadius: '5px',
                    padding:      '6px 10px',
                    fontSize:     '12px',
                  }}>
                    <span style={{ fontWeight: 700, color: meta.color, minWidth: '72px' }}>
                      {meta.label}
                    </span>
                    {log.note && (
                      <span style={{ flex: 1, color: 'var(--text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.note}
                      </span>
                    )}
                    {!log.note && <span style={{ flex: 1 }} />}
                    <span style={{ color: 'var(--text-dimmed)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {fmtLoggedAt(log.logged_at)}
                    </span>
                    <button
                      onClick={() => handleDelete(log.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-dimmed)', fontSize: '13px', padding: '0 2px', lineHeight: 1,
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
