import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTherapyEntry } from '../utils/api/therapyJournal';
import './TherapyJournal.css';

// ── Tiny reusable input primitives (compact, for left panel) ──────────────────
function LeftPillRow({ options, value, onChange }) {
  return (
    <div className="tj-left-pill-row">
      {options.map(o => (
        <button key={String(o.value)} type="button"
          className={`tj-left-pill${value === o.value ? ' sel' : ''}`}
          onClick={() => onChange(value === o.value ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LeftBoolRow({ value, onChange }) {
  return (
    <div className="tj-left-bool-row">
      <button type="button"
        className={`tj-left-bool-btn${value === true  ? ' sel ok'  : ''}`}
        onClick={() => onChange(value === true  ? null : true)}>Yes</button>
      <button type="button"
        className={`tj-left-bool-btn${value === false ? ' sel bad' : ''}`}
        onClick={() => onChange(value === false ? null : false)}>Struggling</button>
    </div>
  );
}

function LeftAffirm({ confirmed, label, onChange }) {
  return (
    <div className={`tj-left-affirm${confirmed ? ' ok' : ''}`} onClick={() => onChange(!confirmed)}>
      <div className="tj-left-affirm-dot">{confirmed ? '✓' : ''}</div>
      <span>{label}</span>
    </div>
  );
}

function LeftTagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tj-left-tag-wrap" onClick={() => ref.current?.focus()}>
      {value.map(t => (
        <span key={t} className="tj-left-tag-badge">
          {t}
          <button type="button" className="tj-left-tag-x"
            onClick={e => { e.stopPropagation(); onChange(value.filter(v => v !== t)); }}>×</button>
        </span>
      ))}
      <input ref={ref} className="tj-left-tag-input" value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add} />
    </div>
  );
}

// ── Right panel: list builder ─────────────────────────────────────────────────
function ListBuilder({ items, onChange, placeholder }) {
  return (
    <div>
      <div className="tj-list-builder">
        {items.map((item, i) => (
          <div key={i} className="tj-list-row">
            <input className="tj-list-input"
              value={typeof item === 'string' ? item : item.text || ''}
              onChange={e => {
                const n = [...items];
                n[i] = typeof item === 'string' ? e.target.value : { ...item, text: e.target.value };
                onChange(n);
              }}
              placeholder={`${placeholder} ${i + 1}`} />
            <button type="button" className="tj-list-remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="tj-add-btn"
        onClick={() => onChange([...items, typeof items[0] === 'string' ? '' : { text: '' }])}>
        + Add {placeholder.toLowerCase()}
      </button>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SLEEP_OPTS  = [1,2,3,4,5].map((v,i) => ({ value: v, label: ['Very poor','Poor','Fair','Good','Great'][i] }));
const EATING_OPTS = [1,2,3,4,5].map((v,i) => ({ value: v, label: ['Skipping','Poor','Fair','Good','Great'][i] }));
const MOOD_OPTS   = [1,2,3,4,5,6,7,8,9,10].map(v => ({ value: v, label: String(v) }));

const TABS = [
  { id: 'info',      label: 'Info' },
  { id: 'summary',   label: 'Summary' },
  { id: 'goals',     label: 'Goals' },
  { id: 'questions', label: 'Questions' },
  { id: 'actions',   label: 'Actions' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'private',   label: 'Private' },
];

const EMPTY_STATE = () => ({
  sleep_quality: null, mood: null, eating: null,
  work_holding: null, school_holding: null,
  substance_use: false, safety_suicidal: false, safety_self_harm: false,
  avoiding: [], helping: [], sleep_notes: '', mood_notes: '',
});

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TherapyEntryNewPage() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split('T')[0];

  const [tab,    setTab]    = useState('info');
  const [saving, setSaving] = useState(false);

  // Form state
  const [entry_date,        setEntryDate]       = useState(today);
  const [session_date,      setSessionDate]     = useState('');
  const [session_label,     setSessionLabel]    = useState('');
  const [context,           setContext]         = useState('');
  const [therapist_summary, setTherapistSum]    = useState('');
  const [narrative,         setNarrative]       = useState('');
  const [notes_to_self,     setNotesToSelf]     = useState('');
  const [actions_taken,     setActions]         = useState([]);
  const [goals,             setGoals]           = useState([{ text: '' }]);
  const [questions,         setQuestions]       = useState([{ text: '' }]);
  const [state,             setStateField]      = useState(EMPTY_STATE);

  const setS = (k, v) => setStateField(prev => ({ ...prev, [k]: v }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        entry_date, session_date: session_date || null,
        session_label: session_label || null,
        context: context || null,
        therapist_summary: therapist_summary || null,
        narrative: narrative || null,
        notes_to_self: notes_to_self || null,
        state,
        actions_taken: actions_taken.filter(Boolean),
        goals: goals.filter(g => (g.text || '').trim()).map((g, i) => ({ text: g.text, priority: i })),
        questions: questions.filter(q => (q.text || '').trim()).map(q => ({ text: q.text })),
      };
      const entry = await createTherapyEntry(payload);
      navigate(`/personal-care/journal/${entry.id}`);
    } finally {
      setSaving(false);
    }
  }, [entry_date, session_date, session_label, context, therapist_summary, narrative,
      notes_to_self, state, actions_taken, goals, questions, navigate]);

  return (
    <div className="tj-page">
      {/* Top bar */}
      <div className="tj-page-topbar">
        <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title">New Entry</span>
        <div className="tj-topbar-actions">
          <button className="tj-btn-secondary" onClick={() => navigate('/personal-care/journal')}>Cancel</button>
          <button className="tj-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </div>

      {/* Two-column body — same grid as detail page */}
      <div className="tj-detail-columns" style={{ flex: 1 }}>

        {/* ── Left panel: wellbeing inputs ─────────────────────────────── */}
        <div className="tj-left-info">

          {/* Wellbeing */}
          <div className="tj-info-section">
            <p className="tj-info-section-title">Wellbeing now</p>

            <div style={{ marginBottom: 10 }}>
              <label className="tj-left-field-label">Sleep quality</label>
              <LeftPillRow options={SLEEP_OPTS} value={state.sleep_quality} onChange={v => setS('sleep_quality', v)} />
              {state.sleep_quality && (
                <input className="tj-left-input" style={{ marginTop: 5 }}
                  value={state.sleep_notes} onChange={e => setS('sleep_notes', e.target.value)}
                  placeholder="Sleep notes…" />
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="tj-left-field-label">Mood (1–10)</label>
              <LeftPillRow options={MOOD_OPTS} value={state.mood} onChange={v => setS('mood', v)} />
              {state.mood && (
                <input className="tj-left-input" style={{ marginTop: 5 }}
                  value={state.mood_notes} onChange={e => setS('mood_notes', e.target.value)}
                  placeholder="Mood notes…" />
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="tj-left-field-label">Eating</label>
              <LeftPillRow options={EATING_OPTS} value={state.eating} onChange={v => setS('eating', v)} />
            </div>

            <div className="tj-form-row" style={{ marginBottom: 10 }}>
              <div>
                <label className="tj-left-field-label">Work</label>
                <LeftBoolRow value={state.work_holding} onChange={v => setS('work_holding', v)} />
              </div>
              <div>
                <label className="tj-left-field-label">School</label>
                <LeftBoolRow value={state.school_holding} onChange={v => setS('school_holding', v)} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="tj-left-field-label">What I'm avoiding</label>
              <LeftTagInput value={state.avoiding} onChange={v => setS('avoiding', v)} placeholder="Type + Enter" />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="tj-left-field-label">What's helping</label>
              <LeftTagInput value={state.helping} onChange={v => setS('helping', v)} placeholder="Type + Enter" />
            </div>

            <div>
              <label className="tj-left-field-label">Safety check</label>
              <LeftAffirm
                confirmed={state.safety_suicidal === false}
                label="No suicidal thoughts"
                onChange={ok => setS('safety_suicidal', ok ? false : null)}
              />
              <LeftAffirm
                confirmed={state.safety_self_harm === false}
                label="No self-harm thoughts"
                onChange={ok => setS('safety_self_harm', ok ? false : null)}
              />
            </div>
          </div>
        </div>

        {/* ── Right panel: tabbed form ──────────────────────────────────── */}
        <div className="tj-right-panel">
          <div className="tj-tabs-bar">
            {TABS.map(t => (
              <button key={t.id}
                className={`tj-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="tj-tab-content">

            {/* Info tab */}
            {tab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="tj-form-row">
                  <div>
                    <label className="tj-section-label">Entry date</label>
                    <input type="date" className="tj-list-input"
                      value={entry_date} onChange={e => setEntryDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="tj-section-label">Session date (optional)</label>
                    <input type="date" className="tj-list-input"
                      value={session_date} onChange={e => setSessionDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="tj-section-label">Session label</label>
                  <input className="tj-list-input"
                    value={session_label} onChange={e => setSessionLabel(e.target.value)}
                    placeholder="e.g. First therapy session, Tuesday" />
                </div>
                <div>
                  <label className="tj-section-label">Context (one line)</label>
                  <input className="tj-list-input"
                    value={context} onChange={e => setContext(e.target.value)}
                    placeholder="What's the main theme of this entry?" />
                </div>
              </div>
            )}

            {/* Summary tab */}
            {tab === 'summary' && (
              <div>
                <p className="tj-section-label">Quick summary for therapist</p>
                <textarea className="tj-new-textarea"
                  value={therapist_summary}
                  onChange={e => setTherapistSum(e.target.value)}
                  placeholder="What do you want your therapist to understand about this period?" />
              </div>
            )}

            {/* Goals tab */}
            {tab === 'goals' && (
              <div>
                <p className="tj-section-label">Therapy goals (what you want to work on)</p>
                <ListBuilder items={goals} onChange={setGoals} placeholder="Goal" />
              </div>
            )}

            {/* Questions tab */}
            {tab === 'questions' && (
              <div>
                <p className="tj-section-label">Open questions to bring to session</p>
                <ListBuilder items={questions} onChange={setQuestions} placeholder="Question" />
              </div>
            )}

            {/* Actions tab */}
            {tab === 'actions' && (
              <div>
                <p className="tj-section-label">Actions taken / commitments</p>
                <ListBuilder items={actions_taken} onChange={setActions} placeholder="Action" />
              </div>
            )}

            {/* Narrative tab */}
            {tab === 'narrative' && (
              <div>
                <p className="tj-section-label">Full narrative</p>
                <textarea className="tj-new-textarea"
                  value={narrative}
                  onChange={e => setNarrative(e.target.value)}
                  placeholder="Write as much or as little as you need. This is for you and your therapist." />
              </div>
            )}

            {/* Private tab */}
            {tab === 'private' && (
              <div className="tj-private-panel">
                <div className="tj-private-label">Private — Notes to self</div>
                <textarea
                  value={notes_to_self}
                  onChange={e => setNotesToSelf(e.target.value)}
                  placeholder="What are you not ready to say out loud yet? This stays private."
                  style={{
                    width: '100%', minHeight: 'calc(100vh - 320px)',
                    background: 'transparent', border: '1px solid rgba(231,76,60,.2)',
                    borderRadius: 6, color: 'var(--text-secondary)', fontSize: 14,
                    lineHeight: 1.7, padding: 12, boxSizing: 'border-box',
                    outline: 'none', resize: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
