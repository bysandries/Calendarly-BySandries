import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGoals } from '../utils/api/personalGoals';
import './TherapyJournal.css';
import './PersonalDashboard.css';

function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const DEFAULT_LABELS = {
  personal:    'Personal Goals',
  short_term:  'Short Term (1 Month)',
  medium_term: 'Medium Term (6 Months)',
  long_term:   'Long Term (1 Year)',
};

const SCOPE_COLORS = {
  personal:    '#FF6B9D',
  short_term:  '#3498DB',
  medium_term: '#F1C40F',
  long_term:   '#2ECC71',
};

function loadScopeLabels() {
  try {
    const raw = localStorage.getItem('scope_labels');
    if (raw) return { ...DEFAULT_LABELS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_LABELS };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const SORT_ORDER = { active: 0, completed: 1, archived: 2 };

export default function GoalsHistoryPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetchGoals({ context: 'personal_care' })
      .then(g => { setGoals(g); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const scopeLabels = loadScopeLabels();

  const filtered = goals
    .filter(g => filterStatus === 'all' || g.status === filterStatus)
    .sort((a, b) => {
      const byOrder = SORT_ORDER[a.status] - SORT_ORDER[b.status];
      if (byOrder !== 0) return byOrder;
      return (b.creation_date || '').localeCompare(a.creation_date || '');
    });

  return (
    <div className="tj-page">
      <div className="tj-page-topbar">
        <Link to="/personal-care" className="tj-topbar-back">← Personal Care</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title">Goal History</span>
        <div className="tj-topbar-actions">
          {['all', 'active', 'completed', 'archived'].map(s => (
            <button
              key={s}
              className={filterStatus === s ? 'tj-btn-primary' : 'tj-btn-secondary'}
              onClick={() => setFilterStatus(s)}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="tj-list-body">
        {loading ? (
          <div className="tj-empty"><span style={{ color: 'var(--text-dimmed)', fontSize: 13 }}>Loading…</span></div>
        ) : filtered.length === 0 ? (
          <div className="tj-empty">
            <span className="tj-empty-icon">🎯</span>
            <span>No goals found.</span>
          </div>
        ) : (
          <div style={{ maxWidth: '960px' }}>
            {filtered.map(g => {
              const scopeLabel = scopeLabels[g.scope] || g.scope;
              const color = SCOPE_COLORS[g.scope] || '#FF6B9D';
              const archHistory = g.archive_history || [];
              const actHistory = g.activation_history || [];
              const lastArchived = archHistory.length > 0 ? archHistory[archHistory.length - 1] : null;
              const lastActivated = actHistory.length > 0 ? actHistory[actHistory.length - 1] : null;
              return (
                <div key={g.id}>
                  <Link
                    to={`/personal-care/goals/${g.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderBottom: '1px solid var(--border)',
                      textDecoration: 'none', color: 'inherit',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color, background: color + '18',
                      borderRadius: '4px', padding: '2px 8px', flexShrink: 0, minWidth: '50px',
                      textAlign: 'center',
                    }}>
                      {scopeLabel}
                    </span>

                    <span style={{
                      flex: 1, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {g.title}
                    </span>

                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: g.status === 'completed' ? '#2ECC71'
                        : g.status === 'archived' ? 'var(--text-dimmed)'
                        : '#FF6B9D',
                      flexShrink: 0,
                    }}>
                      {g.status === 'active' ? 'Active' : g.status === 'completed' ? 'Done' : 'Archived'}
                    </span>

                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', flexShrink: 0 }}>
                      {fmtDate(g.creation_date)}
                    </span>

                    {g.completion_date && (
                      <span style={{ fontSize: '11px', color: '#2ECC71', flexShrink: 0 }}>
                        ✓ {fmtDate(g.completion_date)}
                      </span>
                    )}

                    {lastArchived && (
                      <span style={{ fontSize: '10px', color: 'var(--text-dimmed)', flexShrink: 0 }} title={`Archived: ${fmtDateTime(lastArchived)}`}>
                        🗂 {fmtDate(lastArchived.split(' ')[0])}
                      </span>
                    )}

                    {lastActivated && (
                      <span style={{ fontSize: '10px', color: '#2ECC71', flexShrink: 0 }} title={`Activated: ${fmtDateTime(lastActivated)}`}>
                        ▶ {fmtDate(lastActivated.split(' ')[0])}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
