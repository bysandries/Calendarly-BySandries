import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  fetchTherapyEntry,
  updateTherapyEntry,
  updateTherapyGoal,
  updateTherapyQuestion,
  fetchAvailableSleep,
  fetchAvailableHabits,
} from '../utils/api/therapyJournal';
import { EntryForm } from './TherapyEntryForm';
import './TherapyJournal.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sleepColor(mins) {
  if (!mins) return 'var(--text-dimmed)';
  if (mins >= 420) return '#2ECC71';
  if (mins >= 300) return '#F1C40F';
  return '#E74C3C';
}

function moodColorFn(v) {
  if (!v) return 'var(--text-dimmed)';
  if (v >= 7) return '#2ECC71';
  if (v >= 5) return '#F1C40F';
  return '#E74C3C';
}

// 14 days before a given date (YYYY-MM-DD)
function offsetDate(base, days) {
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const GOAL_CYCLE  = { open: 'in_progress', in_progress: 'resolved', resolved: 'open' };
const GOAL_ICONS  = { open: '○', in_progress: '◔', resolved: '✓' };

// ── Dot rows ──────────────────────────────────────────────────────────────────
function DotRow({ value, max, colorClass }) {
  return (
    <div className="tj-dot-row">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`tj-dot${i < value ? ` on${colorClass ? ` ${colorClass}` : ''}` : ''}`} />
      ))}
    </div>
  );
}

function sleepDotClass(v) { return v <= 1 ? 'red' : v <= 2 ? 'yellow' : 'green'; }
function moodDotClass(v)  { return v <= 3 ? 'red' : v <= 6 ? 'yellow' : 'green'; }

// ── Left panel — Wellbeing ────────────────────────────────────────────────────
function WellbeingPanel({ state }) {
  if (!state) return null;
  return (
    <div className="tj-info-section">
      <p className="tj-info-section-title">Wellbeing</p>

      {state.sleep_quality != null && (
        <div className="tj-metric-row">
          <span className="tj-metric-name">Sleep</span>
          <DotRow value={state.sleep_quality} max={5} colorClass={sleepDotClass(state.sleep_quality)} />
          <span className="tj-metric-val">{state.sleep_quality}/5</span>
        </div>
      )}
      {state.mood != null && (
        <div className="tj-metric-row">
          <span className="tj-metric-name">Mood</span>
          <DotRow value={state.mood} max={10} colorClass={moodDotClass(state.mood)} />
          <span className="tj-metric-val" style={{ color: moodColorFn(state.mood) }}>{state.mood}/10</span>
        </div>
      )}
      {state.eating != null && (
        <div className="tj-metric-row">
          <span className="tj-metric-name">Eating</span>
          <DotRow value={state.eating} max={5} colorClass={sleepDotClass(state.eating)} />
          <span className="tj-metric-val">{state.eating}/5</span>
        </div>
      )}

      <div className="tj-status-row" style={{ marginTop: 8 }}>
        {state.work_holding != null && (
          <span className={`tj-status-badge ${state.work_holding ? 'ok' : 'bad'}`}>Work {state.work_holding ? '✓' : '✗'}</span>
        )}
        {state.school_holding != null && (
          <span className={`tj-status-badge ${state.school_holding ? 'ok' : 'bad'}`}>School {state.school_holding ? '✓' : '✗'}</span>
        )}
        {state.substance_use === false && <span className="tj-status-badge neutral">No substances</span>}
      </div>

      {(state.safety_suicidal === false || state.safety_self_harm === false) && (
        <div className="tj-status-row" style={{ marginTop: 4 }}>
          {state.safety_suicidal === false && <span className="tj-status-badge ok">✓ No SI</span>}
          {state.safety_self_harm === false && <span className="tj-status-badge ok">✓ No SH</span>}
        </div>
      )}

      {state.avoiding?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dimmed)', marginBottom: 4 }}>AVOIDING</div>
          <div className="tj-tag-row">{state.avoiding.map(t => <span key={t} className="tj-tag-pill">{t}</span>)}</div>
        </div>
      )}
      {state.helping?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dimmed)', marginBottom: 4 }}>HELPING</div>
          <div className="tj-tag-row">{state.helping.map(t => <span key={t} className="tj-tag-pill">{t}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// ── Sleep picker modal ────────────────────────────────────────────────────────
function SleepPicker({ entryDate, linked, onSave, onClose }) {
  const defaultStart = offsetDate(entryDate || new Date().toISOString().split('T')[0], -14);
  const defaultEnd   = entryDate || new Date().toISOString().split('T')[0];
  const [start, setStart]   = useState(defaultStart);
  const [end,   setEnd]     = useState(defaultEnd);
  const [rows,  setRows]    = useState([]);
  const [picked, setPicked] = useState(new Set(linked.map(l => l.date_id)));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAvailableSleep({ start, end });
      setRows(data);
    } finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const toggle = (date_id) => setPicked(prev => {
    const n = new Set(prev);
    n.has(date_id) ? n.delete(date_id) : n.add(date_id);
    return n;
  });

  const handleSave = () => {
    const linkedItems = rows.filter(r => picked.has(r.date_id));
    // Also keep any picked items that aren't in current rows (different date range)
    const existing = linked.filter(l => picked.has(l.date_id) && !rows.find(r => r.date_id === l.date_id));
    onSave([...linkedItems, ...existing]);
  };

  return (
    <div className="tj-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tj-modal">
        <div className="tj-modal-header">
          <span className="tj-modal-title">Link Sleep Nights</span>
          <button type="button" className="tj-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tj-picker-range">
          <span>From</span>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          <span>to</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-dimmed)', textAlign: 'center', padding: 20 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-dimmed)', textAlign: 'center', padding: 20 }}>
            No sleep data recorded in this range. Log sleep in the Calendar (sleep area, measure column).
          </p>
        ) : (
          <div className="tj-picker-list">
            {rows.map(r => {
              const isPicked = picked.has(r.date_id);
              const col = sleepColor(r.minutes);
              return (
                <div key={r.date_id} className={`tj-picker-item${isPicked ? ' picked' : ''}`} onClick={() => toggle(r.date_id)}>
                  <div className="tj-picker-check">{isPicked ? '✓' : ''}</div>
                  <div className="tj-picker-label">{fmtDate(r.date_id)}</div>
                  <div className="tj-picker-val" style={{ color: col }}>{fmtDur(r.minutes)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="tj-form-footer" style={{ marginTop: 16 }}>
          <button type="button" className="tj-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="tj-btn-primary" onClick={handleSave}>Save ({picked.size} selected)</button>
        </div>
      </div>
    </div>
  );
}

// ── Habit picker modal ────────────────────────────────────────────────────────
function HabitPicker({ entryDate, linked, onSave, onClose }) {
  const defaultStart = offsetDate(entryDate || new Date().toISOString().split('T')[0], -6);
  const defaultEnd   = entryDate || new Date().toISOString().split('T')[0];
  const [start, setStart]   = useState(defaultStart);
  const [end,   setEnd]     = useState(defaultEnd);
  const [habits, setHabits] = useState([]);
  const [picked, setPicked] = useState(new Set(linked.map(l => l.habit_id)));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAvailableHabits({ start, end });
      setHabits(data);
    } finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setPicked(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleSave = () => {
    const linkedItems = habits
      .filter(h => picked.has(h.id))
      .map(h => ({
        habit_id: h.id, habit_name: h.name, goal_type: h.goal_type,
        completed_days: h.completed_days, total_days: h.total_days,
        date_start: start, date_end: end,
      }));
    onSave(linkedItems);
  };

  return (
    <div className="tj-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tj-modal">
        <div className="tj-modal-header">
          <span className="tj-modal-title">Link Habits</span>
          <button type="button" className="tj-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tj-picker-range">
          <span>Week of</span>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          <span>to</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-dimmed)', textAlign: 'center', padding: 20 }}>Loading…</p>
        ) : habits.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-dimmed)', textAlign: 'center', padding: 20 }}>No active habits found.</p>
        ) : (
          <div className="tj-picker-list">
            {habits.map(h => {
              const isPicked = picked.has(h.id);
              const pct = h.total_days > 0 ? Math.round((h.completed_days / h.total_days) * 100) : 0;
              const col = pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F1C40F' : '#E74C3C';
              return (
                <div key={h.id} className={`tj-picker-item${isPicked ? ' picked' : ''}`} onClick={() => toggle(h.id)}>
                  <div className="tj-picker-check">{isPicked ? '✓' : ''}</div>
                  <div>
                    <div className="tj-picker-label">{h.name}</div>
                    <div className="tj-picker-sub">{h.goal_type} · {h.completed_days}/{h.total_days} days</div>
                  </div>
                  <div className="tj-picker-val" style={{ color: col }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="tj-form-footer" style={{ marginTop: 16 }}>
          <button type="button" className="tj-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="tj-btn-primary" onClick={handleSave}>Save ({picked.size} selected)</button>
        </div>
      </div>
    </div>
  );
}

// ── Left panel — Linked sleep ─────────────────────────────────────────────────
function LinkedSleepPanel({ linked, entryDate, onUpdate }) {
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = async (items) => {
    setShowPicker(false);
    await onUpdate(items);
  };

  const remove = async (date_id) => {
    await onUpdate(linked.filter(l => l.date_id !== date_id));
  };

  return (
    <>
      <div className="tj-info-section">
        <p className="tj-info-section-title">Linked Sleep</p>
        {linked.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-dimmed)', margin: '0 0 6px' }}>No sleep nights linked.</p>
        ) : (
          linked.map(l => (
            <div key={l.date_id} className="tj-linked-item">
              <div className="tj-linked-dot" style={{ background: sleepColor(l.minutes) }} />
              <span className="tj-linked-label">{fmtDateShort(l.date_id)}</span>
              <span className="tj-linked-val" style={{ color: sleepColor(l.minutes) }}>{fmtDur(l.minutes)}</span>
              <button className="tj-linked-remove-btn" onClick={() => remove(l.date_id)} title="Remove">×</button>
            </div>
          ))
        )}
        <button className="tj-linked-add-btn" onClick={() => setShowPicker(true)}>
          + Link sleep night
        </button>
      </div>

      {showPicker && (
        <SleepPicker
          entryDate={entryDate}
          linked={linked}
          onSave={handleSave}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Left panel — Linked habits ────────────────────────────────────────────────
function LinkedHabitsPanel({ linked, entryDate, onUpdate }) {
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = async (items) => {
    setShowPicker(false);
    await onUpdate(items);
  };

  const remove = async (habit_id) => {
    await onUpdate(linked.filter(l => l.habit_id !== habit_id));
  };

  return (
    <>
      <div className="tj-info-section">
        <p className="tj-info-section-title">Linked Habits</p>
        {linked.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-dimmed)', margin: '0 0 6px' }}>No habits linked.</p>
        ) : (
          linked.map(l => {
            const pct = l.total_days > 0 ? Math.round((l.completed_days / l.total_days) * 100) : 0;
            const col = pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F1C40F' : '#E74C3C';
            return (
              <div key={l.habit_id} className="tj-linked-item">
                <div className="tj-linked-dot" style={{ background: col }} />
                <div style={{ flex: 1 }}>
                  <div className="tj-linked-label">{l.habit_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dimmed)' }}>
                    {fmtDateShort(l.date_start)}–{fmtDateShort(l.date_end)} · {l.goal_type}
                  </div>
                </div>
                <span className="tj-linked-val" style={{ color: col }}>{l.completed_days}/{l.total_days}d</span>
                <button className="tj-linked-remove-btn" onClick={() => remove(l.habit_id)} title="Remove">×</button>
              </div>
            );
          })
        )}
        <button className="tj-linked-add-btn" onClick={() => setShowPicker(true)}>
          + Link habit
        </button>
      </div>

      {showPicker && (
        <HabitPicker
          entryDate={entryDate}
          linked={linked}
          onSave={handleSave}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({ entry }) {
  return (
    <>
      {entry.therapist_summary && (
        <div style={{ marginBottom: 24 }}>
          <p className="tj-section-label">Quick summary for therapist</p>
          <p className="tj-summary-text">{entry.therapist_summary}</p>
        </div>
      )}
      {entry.actions_taken?.length > 0 && (
        <div>
          <p className="tj-section-label">Actions taken</p>
          <ul className="tj-actions-list">
            {entry.actions_taken.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
      {!entry.therapist_summary && !entry.actions_taken?.length && (
        <p style={{ fontSize: 13, color: 'var(--text-dimmed)' }}>No summary or actions recorded.</p>
      )}
    </>
  );
}

// ── Tab: Patterns ─────────────────────────────────────────────────────────────
function PatternsTab({ patterns }) {
  if (!patterns?.length) return <p style={{ fontSize: 13, color: 'var(--text-dimmed)' }}>No patterns identified in this entry.</p>;
  return (
    <div className="tj-pattern-list">
      {patterns.map(p => (
        <div key={p.id} className="tj-pattern-card" data-cat={p.category}>
          <div className="tj-pattern-name">{p.name}</div>
          {p.description && <div className="tj-pattern-desc">{p.description}</div>}
          {p.entry_notes && <div className="tj-pattern-notes">"{p.entry_notes}"</div>}
          <div className="tj-pattern-cat">{p.category?.replace('_', ' ')}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Goals & Questions ────────────────────────────────────────────────────
function GoalsTab({ goals, questions, allGoals, onGoalStatus, onAnswerQ }) {
  const display = goals?.length ? goals : allGoals?.filter(g => g.status !== 'resolved').slice(0, 5);
  return (
    <>
      <p className="tj-section-label" style={{ marginTop: 0 }}>Therapy Goals</p>
      <div className="tj-goal-list">
        {display?.length ? display.map(g => (
          <div key={g.id} className="tj-goal-item">
            <button className="tj-goal-status-btn" data-status={g.status}
              title={`Cycle status (current: ${g.status})`}
              onClick={() => onGoalStatus(g.id, GOAL_CYCLE[g.status] || 'open')}>
              {GOAL_ICONS[g.status] || '○'}
            </button>
            <span className={`tj-goal-text${g.status === 'resolved' ? ' resolved' : ''}`}>{g.text}</span>
          </div>
        )) : <p style={{ fontSize: 13, color: 'var(--text-dimmed)' }}>No goals recorded.</p>}
      </div>

      {questions?.length > 0 && (
        <>
          <p className="tj-section-label">Open Questions</p>
          <div className="tj-question-list">
            {questions.map(q => (
              <div key={q.id} className="tj-question-item">
                <span className={`tj-question-text${q.answered ? ' answered' : ''}`}>{q.text}</span>
                {!q.answered && <button className="tj-answer-btn" onClick={() => onAnswerQ(q.id)}>Mark answered</button>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TherapyEntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry]     = useState(null);
  const [allGoals, setAllGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, gs] = await Promise.all([
        fetchTherapyEntry(id),
        import('../utils/api/therapyJournal').then(m => m.fetchTherapyGoals()),
      ]);
      setEntry(e);
      setAllGoals(gs);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Generic field update + optimistic local state
  const patch = useCallback(async (fields) => {
    const updated = await updateTherapyEntry(id, fields);
    setEntry(prev => ({ ...prev, ...updated }));
  }, [id]);

  const handleGoalStatus = useCallback(async (goalId, status) => {
    const updated = await updateTherapyGoal(goalId, { status });
    setEntry(prev => ({
      ...prev,
      goals: prev.goals?.map(g => g.id === goalId ? { ...g, ...updated } : g),
    }));
    setAllGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updated } : g));
  }, []);

  const handleAnswerQ = useCallback(async (qId) => {
    const updated = await updateTherapyQuestion(qId, { answered: true });
    setEntry(prev => ({
      ...prev,
      questions: prev.questions?.map(q => q.id === qId ? { ...q, ...updated } : q),
    }));
  }, []);

  const handleEditSave = useCallback(async (data) => {
    setSaving(true);
    try {
      const updated = await updateTherapyEntry(id, data);
      setEntry(prev => ({ ...prev, ...updated }));
      setShowEdit(false);
    } finally { setSaving(false); }
  }, [id]);

  const handleLinkedSleep = useCallback(async (items) => {
    await patch({ linked_sleep: items });
  }, [patch]);

  const handleLinkedHabits = useCallback(async (items) => {
    await patch({ linked_habits: items });
  }, [patch]);

  if (loading) return (
    <div className="tj-page">
      <div className="tj-page-topbar">
        <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
      </div>
      <div className="tj-empty"><span style={{ color: 'var(--text-dimmed)', fontSize: 13 }}>Loading…</span></div>
    </div>
  );

  if (!entry) return (
    <div className="tj-page">
      <div className="tj-page-topbar">
        <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
      </div>
      <div className="tj-empty">
        <span className="tj-empty-icon">🔍</span>
        <span>Entry not found.</span>
      </div>
    </div>
  );

  const TABS = [
    { id: 'overview',  label: 'Summary' },
    { id: 'patterns',  label: `Patterns${entry.patterns?.length ? ` (${entry.patterns.length})` : ''}` },
    { id: 'goals',     label: 'Goals & Questions' },
    { id: 'narrative', label: 'Narrative' },
    { id: 'private',   label: 'Private' },
  ];

  const entryDateFull = entry.entry_date
    ? new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="tj-page">
      {/* Top bar */}
      <div className="tj-page-topbar">
        <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title" style={{ fontSize: 13 }}>{entry.session_label || entryDateFull}</span>
        <div className="tj-topbar-actions">
          <button className="tj-btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
        </div>
      </div>

      {/* Detail header */}
      <div className="tj-detail-page-header">
        <div className="tj-detail-page-title">
          <h1>{entry.session_label || 'Untitled Entry'}</h1>
          <p>{entryDateFull}{entry.session_date ? ` · Session: ${fmtDate(entry.session_date)}` : ''}</p>
        </div>
        {entry.context && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 480, lineHeight: 1.5 }}>
            {entry.context}
          </p>
        )}
      </div>

      {/* Two-column body */}
      <div className="tj-detail-columns">
        {/* Left: info + linked data */}
        <div className="tj-left-info">
          <WellbeingPanel state={entry.state} />
          <LinkedSleepPanel
            linked={entry.linked_sleep || []}
            entryDate={entry.entry_date}
            onUpdate={handleLinkedSleep}
          />
          <LinkedHabitsPanel
            linked={entry.linked_habits || []}
            entryDate={entry.entry_date}
            onUpdate={handleLinkedHabits}
          />
        </div>

        {/* Right: tabbed content */}
        <div className="tj-right-panel">
          <div className="tj-tabs-bar">
            {TABS.map(t => (
              <button key={t.id} className={`tj-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="tj-tab-content">
            {tab === 'overview'  && <OverviewTab entry={entry} />}
            {tab === 'patterns'  && <PatternsTab patterns={entry.patterns} />}
            {tab === 'goals'     && (
              <GoalsTab
                goals={entry.goals}
                questions={entry.questions}
                allGoals={allGoals}
                onGoalStatus={handleGoalStatus}
                onAnswerQ={handleAnswerQ}
              />
            )}
            {tab === 'narrative' && (
              entry.narrative
                ? <div className="tj-narrative">{entry.narrative}</div>
                : <p style={{ fontSize: 13, color: 'var(--text-dimmed)' }}>No narrative recorded.</p>
            )}
            {tab === 'private'   && (
              <div className="tj-private-panel">
                <div className="tj-private-label">Private</div>
                {entry.notes_to_self
                  ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{entry.notes_to_self}</p>
                  : <p style={{ fontSize: 13, color: 'rgba(231,76,60,.45)' }}>No private notes.</p>
                }
                {entry.reply_drafts?.map((r, i) => (
                  <div key={i} className="tj-reply-block">
                    <div className="tj-reply-to">To: {r.to}</div>
                    <div className="tj-reply-text">{r.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <EntryForm
          initialData={entry}
          onSave={handleEditSave}
          onClose={() => setShowEdit(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
