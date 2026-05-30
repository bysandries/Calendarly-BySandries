import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchTherapyEntry,
  fetchTherapyEntries,
  fetchTherapyPattern,
  updateTherapyEntry,
  updateTherapyGoal,
  updateTherapyQuestion,
  fetchAvailableSleep,
  fetchAvailableHabits,
  createTherapyPattern,
  linkEntryPattern,
  unlinkEntryPattern,
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

// ── Sleep calendar picker ──────────────────────────────────────────────────────
const CAL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toYM(dateId) {
  // returns { year, month } from a YYYY-MM-DD or YYYY-MM string
  const [y, m] = dateId.split('-').map(Number);
  return { year: y, month: m };
}

function calendarCells(year, month) {
  const firstDow  = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMon = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function SleepPicker({ entryDate, linked, onSave, onClose }) {
  const base = entryDate || new Date().toISOString().split('T')[0];
  const [ym, setYm]         = useState(toYM(base));
  const [sleepMap, setSleepMap] = useState({}); // date_id → minutes (accumulated across months)
  const [picked, setPicked]  = useState(new Set(linked.map(l => l.date_id)));
  const [loading, setLoading] = useState(false);

  // Load sleep data whenever the visible month changes
  useEffect(() => {
    const { year, month } = ym;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const last  = new Date(year, month, 0).getDate();
    const end   = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    setLoading(true);
    fetchAvailableSleep({ start, end })
      .then(rows => setSleepMap(prev => {
        const next = { ...prev };
        rows.forEach(r => { next[r.date_id] = r.minutes; });
        return next;
      }))
      .finally(() => setLoading(false));
  }, [ym]);

  // Seed already-linked nights into the map so they show correctly if in another month
  useEffect(() => {
    setSleepMap(prev => {
      const next = { ...prev };
      linked.forEach(l => { if (!(l.date_id in next)) next[l.date_id] = l.minutes; });
      return next;
    });
  }, [linked]);

  const prevMonth = () => setYm(({ year, month }) => {
    const d = new Date(year, month - 2, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const nextMonth = () => setYm(({ year, month }) => {
    const d = new Date(year, month, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const toggle = (dateId) => {
    if (!sleepMap[dateId]) return;
    setPicked(prev => { const n = new Set(prev); n.has(dateId) ? n.delete(dateId) : n.add(dateId); return n; });
  };

  const handleSave = () => {
    const items = Array.from(picked)
      .map(dateId => ({ date_id: dateId, minutes: sleepMap[dateId] || 0 }))
      .filter(i => i.minutes > 0);
    onSave(items);
  };

  const { year, month } = ym;
  const cells = calendarCells(year, month);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="tj-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tj-modal" style={{ maxWidth: 460 }}>
        <div className="tj-modal-header">
          <span className="tj-modal-title">Link Sleep Nights</span>
          <button type="button" className="tj-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Month nav */}
        <div className="tj-cal-nav">
          <button type="button" className="tj-cal-nav-btn" onClick={prevMonth}>‹</button>
          <span className="tj-cal-month-label">{monthLabel}</span>
          <button type="button" className="tj-cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        {/* Calendar grid */}
        <div className="tj-cal-grid">
          {CAL_DAYS.map(d => <div key={d} className="tj-cal-day-header">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="tj-cal-cell empty" />;
            const dateId = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const mins    = sleepMap[dateId];
            const hasData = !!mins;
            const isPicked = picked.has(dateId);
            return (
              <div key={i}
                className={`tj-cal-cell${hasData ? ' has-data' : ' no-data'}${isPicked ? ' picked' : ''}`}
                onClick={() => toggle(dateId)}
                title={hasData ? `${fmtDate(dateId)}: ${fmtDur(mins)}` : fmtDate(dateId)}
              >
                <span className="tj-cal-day-num">{day}</span>
                {hasData
                  ? <span className="tj-cal-sleep-val" style={{ color: sleepColor(mins) }}>{fmtDur(mins)}</span>
                  : <span className="tj-cal-sleep-empty">—</span>
                }
              </div>
            );
          })}
        </div>

        {loading && <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dimmed)', margin: '6px 0 0' }}>Loading…</p>}

        <p className="tj-cal-selected-count">
          {picked.size > 0
            ? `${picked.size} night${picked.size !== 1 ? 's' : ''} selected`
            : 'Click a night with sleep data to select it'}
        </p>

        <div className="tj-form-footer">
          <button type="button" className="tj-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="tj-btn-primary" onClick={handleSave} disabled={picked.size === 0}>
            Save ({picked.size} selected)
          </button>
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
  if (!patterns?.length) return <p style={{ fontSize: 13, color: 'var(--text-dimmed)' }}>No patterns identified in this entry. Use the Edit button to add patterns.</p>;
  return (
    <div className="tj-pattern-list">
      {patterns.map(p => (
        <div key={p.id} className="tj-pattern-card" data-cat={p.category}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div className="tj-pattern-name">{p.name}</div>
            <Link to={`/personal-care/journal/pattern/${p.id}`} className="tj-pattern-more-link" title="View all entries with this pattern">
              More entries →
            </Link>
          </div>
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

// ── Export helper ─────────────────────────────────────────────────────────────
function exportEntry(entry) {
  const payload = {
    __type: 'calendarly-therapy-entry',
    __version: 1,
    __exported_at: new Date().toISOString(),
    entry_date:        entry.entry_date,
    session_date:      entry.session_date      || null,
    session_label:     entry.session_label     || null,
    context:           entry.context           || null,
    therapist_summary: entry.therapist_summary || null,
    narrative:         entry.narrative         || null,
    notes_to_self:     entry.notes_to_self     || null,
    state:             entry.state             || null,
    actions_taken:     entry.actions_taken     || [],
    reply_drafts:      entry.reply_drafts      || [],
    linked_sleep:      entry.linked_sleep      || [],
    linked_habits:     entry.linked_habits     || [],
    patterns: (entry.patterns || []).map(p => ({
      name:        p.name,
      description: p.description || null,
      category:    p.category    || 'other',
      notes:       p.entry_notes || null,
    })),
    goals: (entry.goals || []).map(g => ({
      text:     g.text,
      priority: g.priority,
      status:   g.status,
    })),
    questions: (entry.questions || []).map(q => ({
      text:        q.text,
      answered:    !!q.answered,
      answer_notes: q.answer_notes || null,
      answered_at:  q.answered_at  || null,
    })),
  };

  const slug = (entry.session_label || entry.entry_date || 'entry')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const filename = `therapy-${entry.entry_date || 'entry'}-${slug}.json`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TherapyEntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPattern = searchParams.get('from_pattern'); // pattern ID if navigated from pattern page

  const [entry,      setEntry]     = useState(null);
  const [allGoals,   setAllGoals]  = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [tab,        setTab]       = useState('overview');
  const [showEdit,   setShowEdit]  = useState(false);
  const [saving,     setSaving]    = useState(false);

  // For prev/next when coming from a pattern filter
  const [patternCtx, setPatternCtx] = useState(null);
  // patternCtx = { pattern: {id, name}, entries: [{id, session_label, entry_date}], index: number }

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

  // Load pattern context when coming from a pattern page
  useEffect(() => {
    if (!fromPattern) { setPatternCtx(null); return; }
    Promise.all([
      fetchTherapyPattern(fromPattern),
      fetchTherapyEntries({ pattern_id: fromPattern }),
    ]).then(([pattern, entries]) => {
      const idx = entries.findIndex(e => e.id === id);
      setPatternCtx({ pattern, entries, index: idx });
    }).catch(() => setPatternCtx(null));
  }, [fromPattern, id]);

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
      const { patterns: newPatterns = [], ...mainData } = data;

      // 1. Update main entry fields
      const updated = await updateTherapyEntry(id, mainData);

      // 2. Diff patterns against currently linked
      const currentPatterns = entry?.patterns || [];
      const currentIds = new Set(currentPatterns.map(p => p.id));
      const newExistingIds = new Set(newPatterns.filter(p => p.id).map(p => p.id));

      // Unlink removed patterns
      for (const p of currentPatterns) {
        if (!newExistingIds.has(p.id)) {
          await unlinkEntryPattern(id, p.id);
        }
      }
      // Link newly added existing patterns
      for (const p of newPatterns) {
        if (p.id && !currentIds.has(p.id)) {
          await linkEntryPattern(id, { pattern_id: p.id, notes: p.notes || null });
        }
      }
      // Create and link brand-new patterns
      for (const p of newPatterns) {
        if (!p.id) {
          const created = await createTherapyPattern({ name: p.name, description: p.description, category: p.category || 'other' });
          await linkEntryPattern(id, { pattern_id: created.id, notes: p.notes || null });
        }
      }

      setEntry(prev => ({ ...prev, ...updated }));
      setShowEdit(false);
      load(); // reload to get fresh patterns list
    } finally { setSaving(false); }
  }, [id, entry, load]);

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
        {patternCtx ? (
          <Link to={`/personal-care/journal/pattern/${fromPattern}`} className="tj-topbar-back">
            ← {patternCtx.pattern?.name || 'Pattern'}
          </Link>
        ) : (
          <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
        )}
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title" style={{ fontSize: 13 }}>{entry.session_label || entryDateFull}</span>
        <div className="tj-topbar-actions">
          <button className="tj-btn-secondary" onClick={() => exportEntry(entry)} title="Download as JSON">Export ↓</button>
          <button className="tj-btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
        </div>
      </div>

      {/* Pattern prev/next nav */}
      {patternCtx && patternCtx.entries.length > 1 && (
        <div className="tj-pattern-nav">
          <button className="tj-pattern-nav-btn"
            disabled={patternCtx.index <= 0}
            onClick={() => {
              const prev = patternCtx.entries[patternCtx.index - 1];
              if (prev) navigate(`/personal-care/journal/${prev.id}?from_pattern=${fromPattern}`);
            }}>
            ‹ Prev
          </button>
          <span className="tj-pattern-nav-label">
            Entry {patternCtx.index + 1} of {patternCtx.entries.length} with this pattern
          </span>
          <button className="tj-pattern-nav-btn"
            disabled={patternCtx.index >= patternCtx.entries.length - 1}
            onClick={() => {
              const next = patternCtx.entries[patternCtx.index + 1];
              if (next) navigate(`/personal-care/journal/${next.id}?from_pattern=${fromPattern}`);
            }}>
            Next ›
          </button>
        </div>
      )}

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
