import { useState, useEffect, useCallback } from 'react';
import {
  fetchCodeAgentSessions,
  fetchCodeAgentStats,
  createCodeAgentSession,
  deleteCodeAgentSession,
} from '../utils/api/codeAgents';
import {
  fetchOpenCodeSessions,
  fetchOpenCodeStats,
  syncOpenCode,
} from '../utils/api/opencode';
import './AgentsPage.css';

const AGENTS = ['Claude', 'OpenCode', 'Gemini', 'Antigravity'];

const AGENT_META = {
  Claude:      { color: '#E67E22', icon: '◎', glow: '0 0 20px rgba(230,126,34,0.35)' },
  OpenCode:    { color: '#3498DB', icon: '⬡', glow: '0 0 20px rgba(52,152,219,0.35)' },
  Gemini:      { color: '#9B59B6', icon: '✦', glow: '0 0 20px rgba(155,89,182,0.35)' },
  Antigravity: { color: '#2ECC71', icon: '⟁', glow: '0 0 20px rgba(46,204,113,0.35)' },
};

const EMPTY_FORM = {
  agent: 'Claude',
  session_date: new Date().toISOString().slice(0, 10),
  started_at: '',
  ended_at: '',
  duration_minutes: '',
  input_tokens: '',
  output_tokens: '',
  cache_read_tokens: '',
  cache_write_tokens: '',
  model: '',
  project_context: '',
  notes: '',
};

function fmt(n, digits = 0) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function fmtCost(n) {
  return `$${Number(n || 0).toFixed(4)}`;
}

function fmtTime(minutes) {
  const m = Number(minutes || 0);
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="agent-stat-card">
      <div className="agent-stat-value">{value}</div>
      <div className="agent-stat-label">{label}</div>
      {sub && <div className="agent-stat-sub">{sub}</div>}
    </div>
  );
}

function LogModal({ defaultAgent, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, agent: defaultAgent });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.started_at) { setError('Start time is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        agent: form.agent,
        session_date: form.session_date,
        started_at: new Date(form.started_at).toISOString(),
        ended_at: form.ended_at ? new Date(form.ended_at).toISOString() : undefined,
        duration_minutes: form.duration_minutes ? parseFloat(form.duration_minutes) : 0,
        input_tokens: parseInt(form.input_tokens, 10) || 0,
        output_tokens: parseInt(form.output_tokens, 10) || 0,
        cache_read_tokens: parseInt(form.cache_read_tokens, 10) || 0,
        cache_write_tokens: parseInt(form.cache_write_tokens, 10) || 0,
        model: form.model || undefined,
        project_context: form.project_context || undefined,
        notes: form.notes || undefined,
        source: 'manual',
      };
      // Auto-compute duration from times if not provided
      if (!payload.duration_minutes && payload.started_at && payload.ended_at) {
        payload.duration_minutes =
          (new Date(payload.ended_at) - new Date(payload.started_at)) / 60000;
      }
      await createCodeAgentSession(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="agents-modal-overlay" onClick={onClose}>
      <div className="agents-modal" onClick={e => e.stopPropagation()}>
        <div className="agents-modal-header">
          <h3>Log Agent Session</h3>
          <button className="agents-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="agents-form">
          <div className="agents-form-row">
            <label>Agent</label>
            <select value={form.agent} onChange={e => set('agent', e.target.value)}>
              {AGENTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          <div className="agents-form-row">
            <label>Date</label>
            <input type="date" value={form.session_date} onChange={e => set('session_date', e.target.value)} />
          </div>

          <div className="agents-form-2col">
            <div className="agents-form-row">
              <label>Started at</label>
              <input type="datetime-local" value={form.started_at} onChange={e => set('started_at', e.target.value)} />
            </div>
            <div className="agents-form-row">
              <label>Ended at</label>
              <input type="datetime-local" value={form.ended_at} onChange={e => set('ended_at', e.target.value)} />
            </div>
          </div>

          <div className="agents-form-row">
            <label>Duration (minutes) <span className="agents-form-hint">— auto-computed from times if blank</span></label>
            <input type="number" min="0" step="0.1" placeholder="0" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} />
          </div>

          <div className="agents-form-section-label">Tokens</div>
          <div className="agents-form-2col">
            <div className="agents-form-row">
              <label>Input</label>
              <input type="number" min="0" placeholder="0" value={form.input_tokens} onChange={e => set('input_tokens', e.target.value)} />
            </div>
            <div className="agents-form-row">
              <label>Output</label>
              <input type="number" min="0" placeholder="0" value={form.output_tokens} onChange={e => set('output_tokens', e.target.value)} />
            </div>
            <div className="agents-form-row">
              <label>Cache read</label>
              <input type="number" min="0" placeholder="0" value={form.cache_read_tokens} onChange={e => set('cache_read_tokens', e.target.value)} />
            </div>
            <div className="agents-form-row">
              <label>Cache write</label>
              <input type="number" min="0" placeholder="0" value={form.cache_write_tokens} onChange={e => set('cache_write_tokens', e.target.value)} />
            </div>
          </div>

          <div className="agents-form-row">
            <label>Model</label>
            <input type="text" placeholder="e.g. claude-sonnet-4-6" value={form.model} onChange={e => set('model', e.target.value)} />
          </div>

          <div className="agents-form-row">
            <label>Project / Context</label>
            <input type="text" placeholder="What were you working on?" value={form.project_context} onChange={e => set('project_context', e.target.value)} />
          </div>

          <div className="agents-form-row">
            <label>Notes</label>
            <textarea rows={2} placeholder="Optional notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {error && <div className="agents-form-error">{error}</div>}

          <div className="agents-form-actions">
            <button type="button" className="agents-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="agents-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [activeAgent, setActiveAgent] = useState('Claude');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // OpenCode sync state
  const [ocSessions, setOcSessions] = useState([]);
  const [ocStats, setOcStats] = useState(null);
  const [ocLastSync, setOcLastSync] = useState(null);
  const [ocSyncing, setOcSyncing] = useState(false);
  const [ocError, setOcError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionList, statRows] = await Promise.all([
        fetchCodeAgentSessions({ agent: activeAgent }),
        fetchCodeAgentStats(),
      ]);
      setSessions(sessionList);
      const statsMap = {};
      for (const row of statRows) statsMap[row.agent] = row;
      setStats(statsMap);
    } finally {
      setLoading(false);
    }
  }, [activeAgent]);

  const loadOpenCode = useCallback(async () => {
    setOcError('');
    try {
      const [sessRes, statsRes] = await Promise.all([
        fetchOpenCodeSessions(),
        fetchOpenCodeStats(),
      ]);
      setOcSessions(sessRes.sessions || []);
      setOcStats(statsRes.stats);
      setOcLastSync(statsRes.lastSync || sessRes.lastSync);
    } catch (err) {
      setOcError(err.message || 'Failed to load OpenCode data');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadOpenCode(); }, [loadOpenCode]);

  async function handleOpenCodeSync() {
    setOcSyncing(true);
    setOcError('');
    try {
      await syncOpenCode();
      await loadOpenCode();
    } catch (err) {
      setOcError(err.message || 'Sync failed');
    } finally {
      setOcSyncing(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this session?')) return;
    await deleteCodeAgentSession(id);
    load();
  }

  const agentStats = stats[activeAgent] || {};
  const totalTokens = (agentStats.total_input_tokens || 0) + (agentStats.total_output_tokens || 0);

  // Global totals across all agents (manual + OpenCode)
  const manualSessions = Object.values(stats).reduce((s, r) => s + (r.session_count || 0), 0);
  const manualMinutes  = Object.values(stats).reduce((s, r) => s + (r.total_minutes   || 0), 0);
  const manualTokens   = Object.values(stats).reduce((s, r) => s + (r.total_input_tokens || 0) + (r.total_output_tokens || 0), 0);
  const manualCost     = Object.values(stats).reduce((s, r) => s + (r.total_cost_usd  || 0), 0);

  const ocSessionCount = ocStats?.sessions || 0;
  const ocTokenCount   = (ocStats?.input_tokens || 0) + (ocStats?.output_tokens || 0);
  const ocCost         = ocStats?.total_cost_usd || 0;

  const globalSessions = manualSessions + ocSessionCount;
  const globalMinutes  = manualMinutes; // OpenCode doesn't track minutes directly
  const globalTokens   = manualTokens + ocTokenCount;
  const globalCost     = manualCost + ocCost;

  const { color: agentColor, glow: agentGlow } = AGENT_META[activeAgent];

  return (
    <div className="page-container agents-page">
      <div className="page-header">
        <div>
          <h2>Code Agents</h2>
          <p className="page-description">Track time, sessions, and token usage across your AI coding agents.</p>
        </div>
        {activeAgent !== 'OpenCode' && (
          <button className="agents-btn-primary" onClick={() => setShowModal(true)}>
            + Log Session
          </button>
        )}
      </div>

      {/* Global overview */}
      <div className="agents-global-stats">
        <StatCard label="Total Sessions" value={fmt(globalSessions)} />
        <StatCard label="Total Time" value={fmtTime(globalMinutes)} />
        <StatCard label="Total Tokens" value={fmt(globalTokens)} />
        <StatCard label="Total Cost" value={fmtCost(globalCost)} sub="Claude only" />
      </div>

      {/* Agent tabs */}
      <div className="agents-tabs">
        {AGENTS.map(agent => {
          const meta = AGENT_META[agent];
          const s = stats[agent];
          const ocCount = ocStats?.sessions || 0;
          const badgeCount = agent === 'OpenCode' ? ocCount : (s?.session_count || 0);
          return (
            <button
              key={agent}
              className={`agents-tab ${activeAgent === agent ? 'active' : ''}`}
              style={activeAgent === agent ? { '--agent-color': meta.color, '--agent-glow': meta.glow } : {}}
              onClick={() => setActiveAgent(agent)}
            >
              <span className="agents-tab-icon" style={{ color: meta.color }}>{meta.icon}</span>
              <span className="agents-tab-name">{agent}</span>
              {badgeCount > 0 && (
                <span className="agents-tab-badge" style={{ background: meta.color + '22', color: meta.color }}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-agent stats — OpenCode view */}
      {activeAgent === 'OpenCode' ? (
        <>
          <div className="agents-agent-stats" style={{ '--agent-color': agentColor }}>
            <StatCard label="Sessions" value={fmt(ocStats?.sessions || 0)} />
            <StatCard label="Messages" value={fmt(ocStats?.messages || 0)} />
            <StatCard label="Input Tokens" value={fmt(ocStats?.input_tokens || 0)} sub={`Cache read: ${fmt(ocStats?.cache_read_tokens || 0)}`} />
            <StatCard label="Output Tokens" value={fmt(ocStats?.output_tokens || 0)} sub={`Cache write: ${fmt(ocStats?.cache_write_tokens || 0)}`} />
            <StatCard label="Total Tokens" value={fmt((ocStats?.input_tokens || 0) + (ocStats?.output_tokens || 0))} />
            <StatCard label="Total Cost" value={fmtCost(ocStats?.total_cost_usd || 0)} sub="From OpenCode CLI" />
          </div>

          {/* OpenCode Sync Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {ocLastSync && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Last sync: {new Date(ocLastSync).toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a
                href="https://opencode.ai/workspace/wrk_01KQRYAV6MR8BAW53RTNDXKDVE/usage"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                OpenCode Usage Dashboard ↗
              </a>
              <button
                className="btn btn-primary"
                onClick={handleOpenCodeSync}
                disabled={ocSyncing}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                {ocSyncing ? 'Syncing…' : 'Sync from OpenCode CLI'}
              </button>
            </div>
          </div>

          {ocError && (
            <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.85rem', color: '#e74c3c' }}>
              <strong>Sync note:</strong> {ocError}
              <div style={{ marginTop: '6px', fontSize: '0.78rem', opacity: 0.8 }}>
                Run <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>./scripts/sync-opencode.sh</code> on the host machine, then switch tabs to refresh.
              </div>
            </div>
          )}

          {/* Model Breakdown — this is the "per-agent" view for OpenCode */}
          {ocStats && ocStats.models && ocStats.models.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Models Used (per "agent" model)
              </h4>
              <div className="agents-table-wrap">
                <table className="agents-table">
                  <thead>
                    <tr>
                      <th>Model / Provider</th>
                      <th>Messages</th>
                      <th>Input Tokens</th>
                      <th>Output Tokens</th>
                      <th>Cache Read</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocStats.models.map((m, i) => (
                      <tr key={i}>
                        <td className="agents-td-context" style={{ fontWeight: 500 }}>{m.name}</td>
                        <td>{fmt(m.messages)}</td>
                        <td>{fmt(m.input_tokens)}</td>
                        <td>{fmt(m.output_tokens)}</td>
                        <td className="agents-td-muted">{fmt(m.cache_read_tokens)}</td>
                        <td>{fmtCost(m.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent OpenCode Sessions */}
          {ocSessions.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent OpenCode Sessions
              </h4>
              <div className="agents-table-wrap">
                <table className="agents-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Project Directory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocSessions.map(s => (
                      <tr key={s.id}>
                        <td className="agents-td-context" style={{ fontWeight: 500 }}>{s.title}</td>
                        <td className="agents-td-date">
                          <div>{new Date(s.created).toLocaleDateString()}</div>
                          <div className="agents-td-sub">{new Date(s.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="agents-td-date">
                          <div>{new Date(s.updated).toLocaleDateString()}</div>
                          <div className="agents-td-sub">{new Date(s.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="agents-td-muted">{s.directory || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!ocStats && !ocError && (
            <div className="agents-empty" style={{ padding: '24px' }}>
              No OpenCode data cached yet.
              <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Click <strong>Sync from OpenCode CLI</strong> above, or run{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>./scripts/sync-opencode.sh</code> on the host.
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Per-agent stats — manual agents */}
          <div className="agents-agent-stats" style={{ '--agent-color': agentColor }}>
            <StatCard
              label="Sessions"
              value={fmt(agentStats.session_count)}
            />
            <StatCard
              label="Total Time"
              value={fmtTime(agentStats.total_minutes)}
            />
            <StatCard
              label="Input Tokens"
              value={fmt(agentStats.total_input_tokens)}
              sub={`Cache read: ${fmt(agentStats.total_cache_read_tokens)}`}
            />
            <StatCard
              label="Output Tokens"
              value={fmt(agentStats.total_output_tokens)}
              sub={`Cache write: ${fmt(agentStats.total_cache_write_tokens)}`}
            />
            <StatCard
              label="Total Tokens"
              value={fmt(totalTokens)}
            />
            <StatCard
              label="Estimated Cost"
              value={fmtCost(agentStats.total_cost_usd)}
              sub={activeAgent !== 'Claude' ? 'N/A' : 'Anthropic pricing'}
            />
          </div>

          {/* Session list */}
          <div className="agents-table-wrap">
            {loading ? (
              <div className="agents-empty">Loading…</div>
            ) : sessions.length === 0 ? (
              <div className="agents-empty">
                No {activeAgent} sessions yet.
                {activeAgent === 'Claude' && (
                  <span> Sessions are auto-captured via Claude Code hooks, or log one manually.</span>
                )}
              </div>
            ) : (
              <table className="agents-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Input</th>
                    <th>Output</th>
                    <th>Cache R/W</th>
                    <th>Cost</th>
                    <th>Model</th>
                    <th>Context</th>
                    <th>Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td className="agents-td-date">
                        <div>{s.session_date}</div>
                        <div className="agents-td-sub">{s.started_at ? new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                      </td>
                      <td>{fmtTime(s.duration_minutes)}</td>
                      <td>{fmt(s.input_tokens)}</td>
                      <td>{fmt(s.output_tokens)}</td>
                      <td className="agents-td-muted">{fmt(s.cache_read_tokens)} / {fmt(s.cache_write_tokens)}</td>
                      <td>{fmtCost(s.total_cost_usd)}</td>
                      <td className="agents-td-muted">{s.model || '—'}</td>
                      <td className="agents-td-context">{s.project_context || s.notes || '—'}</td>
                      <td>
                        <span className={`agents-source-badge agents-source-${s.source}`}>
                          {s.source === 'hook' ? 'auto' : 'manual'}
                        </span>
                      </td>
                      <td>
                        <button className="agents-delete-btn" onClick={() => handleDelete(s.id)} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {showModal && (
            <LogModal
              defaultAgent={activeAgent}
              onClose={() => setShowModal(false)}
              onSaved={load}
            />
          )}
        </>
      )}
    </div>
  );
}
