import React, { useState, useEffect } from 'react';
import { fetchOmniHistory, deleteOmniEntity } from '../utils/api';
import { DateTime } from 'luxon';

export default function OmniHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await fetchOmniHistory();
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch omni history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      await deleteOmniEntity(type, id);
      await loadHistory();
    } catch (err) {
      console.error('Failed to delete entity', err);
      alert('Failed to delete entity');
    }
  };

  const getEntityStatus = (ent) => {
    if (ent.soft_deleted) return <span style={{ color: 'var(--text-dimmed)', fontSize: '11px', fontStyle: 'italic' }}>Soft Deleted</span>;
    if (!ent.exists) return <span style={{ color: 'var(--accent-danger)', fontSize: '11px', fontStyle: 'italic' }}>Permanently Deleted</span>;
    return <span style={{ color: 'var(--accent-success)', fontSize: '11px', fontWeight: 600 }}>Active</span>;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Omni Capture History
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Review your AI brain dumps and manage the tasks, pomodoros, and logs it created.
        </p>
      </header>

      {loading ? (
        <div style={{ color: 'var(--text-dimmed)', fontSize: '14px' }}>Loading history...</div>
      ) : logs.length === 0 ? (
        <div style={{ color: 'var(--text-dimmed)', fontSize: '14px' }}>No captures found. Try adding one with 'G'!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {logs.map(log => {
            let entities = [];
            try {
              entities = JSON.parse(log.created_entities || '[]');
            } catch (e) { }

            return (
              <div key={log.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginBottom: '12px' }}>
                  {DateTime.fromISO(log.created_at).toLocaleString(DateTime.DATETIME_MED)}
                </div>
                
                <div style={{
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                  paddingLeft: '12px',
                  borderLeft: '2px solid var(--accent-primary)'
                }}>
                  {log.prompt}
                </div>

                {entities.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                      Created Items
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {entities.map((ent, i) => (
                        <li key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          fontSize: '13px', borderBottom: i < entities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          paddingBottom: i < entities.length - 1 ? '8px' : '0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ 
                              background: 'rgba(255,255,255,0.1)', padding: '2px 8px', 
                              borderRadius: '4px', fontSize: '11px', textTransform: 'capitalize' 
                            }}>
                              {ent.type}
                            </span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{ent.id.substring(0, 10)}...</span>
                            {getEntityStatus(ent)}
                          </div>
                          
                          {ent.exists && !ent.soft_deleted && (
                            <button
                              onClick={() => handleDelete(ent.type, ent.id)}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(231,76,60,0.3)',
                                color: '#e74c3c',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(231,76,60,0.1)';
                                e.currentTarget.style.borderColor = 'rgba(231,76,60,0.5)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(231,76,60,0.3)';
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
