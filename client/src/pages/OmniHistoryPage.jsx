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
    if (ent.soft_deleted) return <span className="omni-status soft-deleted">Soft Deleted</span>;
    if (!ent.exists) return <span className="omni-status permanently-deleted">Permanently Deleted</span>;
    return <span className="omni-status active">Active</span>;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'task': return '#3498DB';
      case 'pomodoro': return '#E67E22';
      case 'distraction': return '#E74C3C';
      case 'therapy': return '#9B59B6';
      case 'habit_log': return '#2ECC71';
      case 'memory': return '#F1C40F';
      default: return '#95A5A6';
    }
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Omni Capture History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            Review your AI brain dumps and manage the tasks, pomodoros, and logs it created.
          </p>
        </header>

        {loading ? (
          <div className="no-analytics-data">
            <span style={{ fontSize: '24px' }}>⏳</span>
            <span>Loading history...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="no-analytics-data">
            <span style={{ fontSize: '24px' }}>📝</span>
            <span>No captures found. Try adding one with 'G'!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {logs.map(log => {
              let entities = [];
              try {
                entities = JSON.parse(log.created_entities || '[]');
              } catch (e) { }

              return (
                <div key={log.id} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📅</span>
                    {DateTime.fromISO(log.created_at).toLocaleString(DateTime.DATETIME_MED)}
                  </div>
                  
                  <div style={{
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    marginBottom: '16px',
                    paddingLeft: '12px',
                    borderLeft: '3px solid var(--accent-primary)',
                    lineHeight: 1.5
                  }}>
                    {log.prompt}
                  </div>

                  {entities.length > 0 && (
                    <div style={{ 
                      background: 'rgba(255,255,255,0.04)', 
                      padding: '16px', 
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      <h4 style={{ 
                        fontSize: '11px', 
                        textTransform: 'uppercase', 
                        color: 'var(--text-secondary)', 
                        marginBottom: '12px', 
                        letterSpacing: '0.08em',
                        fontWeight: 600
                      }}>
                        Created Items ({entities.length})
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {entities.map((ent, i) => (
                          <li key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: '13px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <span style={{ 
                                background: `${getTypeColor(ent.type)}22`,
                                color: getTypeColor(ent.type),
                                padding: '3px 10px', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                textTransform: 'capitalize',
                                fontWeight: 600,
                                border: `1px solid ${getTypeColor(ent.type)}44`
                              }}>
                                {ent.type}
                              </span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '12px' }}>
                                {ent.id.substring(0, 12)}...
                              </span>
                              {getEntityStatus(ent)}
                            </div>
                            
                            {ent.exists && !ent.soft_deleted && (
                              <button
                                onClick={() => handleDelete(ent.type, ent.id)}
                                className="btn btn-danger"
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  marginLeft: '12px'
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
    </div>
  );
}
