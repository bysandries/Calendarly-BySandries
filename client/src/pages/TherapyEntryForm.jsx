import { useState, useRef } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildInitial(initial) {
  const today = new Date().toISOString().split('T')[0];
  if (!initial) return {
    entry_date: today, session_date: '', session_label: '', context: '',
    therapist_summary: '', narrative: '', notes_to_self: '',
    state: {
      sleep_quality: null, mood: null, eating: null,
      work_holding: null, school_holding: null,
      substance_use: false, safety_suicidal: false, safety_self_harm: false,
      avoiding: [], helping: [], sleep_notes: '', mood_notes: '',
    },
    actions_taken: [], reply_drafts: [], goals: [], questions: [], patterns: [],
  };
  return {
    entry_date:        initial.entry_date        || today,
    session_date:      initial.session_date      || '',
    session_label:     initial.session_label     || '',
    context:           initial.context           || '',
    therapist_summary: initial.therapist_summary || '',
    narrative:         initial.narrative         || '',
    notes_to_self:     initial.notes_to_self     || '',
    state: {
      sleep_quality:    initial.state?.sleep_quality    ?? null,
      mood:             initial.state?.mood              ?? null,
      eating:           initial.state?.eating            ?? null,
      work_holding:     initial.state?.work_holding      ?? null,
      school_holding:   initial.state?.school_holding    ?? null,
      substance_use:    initial.state?.substance_use     ?? false,
      safety_suicidal:  initial.state?.safety_suicidal   ?? false,
      safety_self_harm: initial.state?.safety_self_harm  ?? false,
      avoiding:         initial.state?.avoiding           ?? [],
      helping:          initial.state?.helping            ?? [],
      sleep_notes:      initial.state?.sleep_notes        ?? '',
      mood_notes:       initial.state?.mood_notes         ?? '',
    },
    actions_taken: initial.actions_taken || [],
    reply_drafts:  initial.reply_drafts  || [],
    goals: [], questions: [], patterns: [],
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PillRow({ options, value, onChange }) {
  return (
    <div className="tj-pill-row">
      {options.map(o => (
        <button key={o.value} type="button"
          className={`tj-pill${value === o.value ? ' sel' : ''}`}
          onClick={() => onChange(value === o.value ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tj-tag-wrap" onClick={() => ref.current?.focus()}>
      {value.map(t => (
        <span key={t} className="tj-tag-badge">
          {t}
          <button type="button" className="tj-tag-x" onClick={e => { e.stopPropagation(); onChange(value.filter(v => v !== t)); }}>×</button>
        </span>
      ))}
      <input ref={ref} className="tj-tag-input" value={draft} placeholder={value.length ? '' : placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add} />
    </div>
  );
}

function ListBuilder({ items, onChange, placeholder }) {
  return (
    <div>
      <div className="tj-list-builder">
        {items.map((item, i) => (
          <div key={i} className="tj-list-row">
            <input className="tj-list-input"
              value={typeof item === 'string' ? item : item.text || ''}
              onChange={e => { const n = [...items]; n[i] = typeof item === 'string' ? e.target.value : { ...item, text: e.target.value }; onChange(n); }}
              placeholder={`${placeholder} ${i + 1}`} />
            <button type="button" className="tj-list-remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="tj-add-btn" onClick={() => onChange([...items, typeof items[0] === 'string' ? '' : { text: '' }])}>
        + Add {placeholder.toLowerCase()}
      </button>
    </div>
  );
}

function AffirmToggle({ confirmed, label, onChange }) {
  return (
    <div className={`tj-affirm${confirmed ? ' ok' : ''}`} onClick={() => onChange(!confirmed)}>
      <div className="tj-affirm-dot">{confirmed ? '✓' : ''}</div>
      <span>{label}</span>
    </div>
  );
}

const SLEEP_OPTS  = [1,2,3,4,5].map((v,i) => ({ value: v, label: ['Very poor','Poor','Fair','Good','Great'][i] }));
const EATING_OPTS = [1,2,3,4,5].map((v,i) => ({ value: v, label: ['Skipping','Poor','Fair','Good','Great'][i] }));
const MOOD_OPTS   = [1,2,3,4,5,6,7,8,9,10].map(v => ({ value: v, label: String(v) }));
const BOOL_OPTS   = [{ value: true, label: 'Yes' }, { value: false, label: 'Struggling' }];

// ── Main exported form ────────────────────────────────────────────────────────
export function EntryForm({ onSave, onClose, saving, initialData }) {
  const isEditing = !!initialData;
  const [form, setForm] = useState(() => buildInitial(initialData));

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setS = (k, v) => setForm(f => ({ ...f, state: { ...f.state, [k]: v } }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      actions_taken: form.actions_taken.filter(Boolean),
      goals: form.goals.filter(g => (typeof g === 'string' ? g : g.text || '').trim()).map((g, i) => ({ text: typeof g === 'string' ? g : g.text, priority: i })),
      questions: form.questions.filter(q => (typeof q === 'string' ? q : q.text || '').trim()).map(q => ({ text: typeof q === 'string' ? q : q.text })),
      reply_drafts: form.reply_drafts.filter(r => r?.text?.trim()),
    });
  };

  return (
    <div className="tj-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tj-modal">
        <div className="tj-modal-header">
          <span className="tj-modal-title">{isEditing ? 'Edit Entry' : 'New Journal Entry'}</span>
          <button type="button" className="tj-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Dates + label */}
          <div className="tj-form-section">
            <div className="tj-form-row">
              <div>
                <label className="tj-form-label">Entry date</label>
                <input type="date" className="tj-form-input" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
              </div>
              <div>
                <label className="tj-form-label">Session date (optional)</label>
                <input type="date" className="tj-form-input" value={form.session_date} onChange={e => set('session_date', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="tj-form-section">
            <label className="tj-form-label">Session label</label>
            <input className="tj-form-input" value={form.session_label} onChange={e => set('session_label', e.target.value)} placeholder="e.g. First therapy session, Tuesday" />
          </div>

          <div className="tj-form-section">
            <label className="tj-form-label">Context (one line)</label>
            <input className="tj-form-input" value={form.context} onChange={e => set('context', e.target.value)} placeholder="What's the main theme?" />
          </div>

          {/* Wellbeing */}
          <div className="tj-form-section">
            <label className="tj-form-label">Wellbeing now</label>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>Sleep quality</div>
              <PillRow options={SLEEP_OPTS} value={form.state.sleep_quality} onChange={v => setS('sleep_quality', v)} />
              {form.state.sleep_quality && <input className="tj-form-input" style={{ marginTop: 6 }} value={form.state.sleep_notes} onChange={e => setS('sleep_notes', e.target.value)} placeholder="Sleep notes" />}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>Mood (1–10)</div>
              <PillRow options={MOOD_OPTS} value={form.state.mood} onChange={v => setS('mood', v)} />
              {form.state.mood && <input className="tj-form-input" style={{ marginTop: 6 }} value={form.state.mood_notes} onChange={e => setS('mood_notes', e.target.value)} placeholder="Mood notes" />}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>Eating</div>
              <PillRow options={EATING_OPTS} value={form.state.eating} onChange={v => setS('eating', v)} />
            </div>

            <div className="tj-form-row" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>Work holding?</div>
                <PillRow options={BOOL_OPTS} value={form.state.work_holding} onChange={v => setS('work_holding', v)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>School holding?</div>
                <PillRow options={BOOL_OPTS} value={form.state.school_holding} onChange={v => setS('school_holding', v)} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>What I'm avoiding</div>
              <TagInput value={form.state.avoiding} onChange={v => setS('avoiding', v)} placeholder="Type + Enter" />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>What's helping</div>
              <TagInput value={form.state.helping} onChange={v => setS('helping', v)} placeholder="Type + Enter" />
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dimmed)', marginBottom: 5 }}>Safety check</div>
              <div className="tj-safety-row">
                <AffirmToggle confirmed={form.state.safety_suicidal === false} label="No suicidal thoughts" onChange={ok => setS('safety_suicidal', ok ? false : null)} />
                <AffirmToggle confirmed={form.state.safety_self_harm === false} label="No self-harm thoughts" onChange={ok => setS('safety_self_harm', ok ? false : null)} />
              </div>
            </div>
          </div>

          {/* Therapist summary */}
          <div className="tj-form-section">
            <label className="tj-form-label">Quick summary for therapist</label>
            <textarea className="tj-form-textarea" value={form.therapist_summary} onChange={e => set('therapist_summary', e.target.value)} placeholder="What do you want your therapist to understand?" />
          </div>

          {!isEditing && (
            <>
              <div className="tj-form-section">
                <label className="tj-form-label">Therapy goals</label>
                <ListBuilder items={form.goals} onChange={v => set('goals', v)} placeholder="Goal" />
              </div>
              <div className="tj-form-section">
                <label className="tj-form-label">Open questions</label>
                <ListBuilder items={form.questions} onChange={v => set('questions', v)} placeholder="Question" />
              </div>
            </>
          )}

          <div className="tj-form-section">
            <label className="tj-form-label">Actions taken</label>
            <ListBuilder items={form.actions_taken} onChange={v => set('actions_taken', v)} placeholder="Action" />
          </div>

          <div className="tj-form-section">
            <label className="tj-form-label">Full narrative</label>
            <textarea className="tj-form-textarea large" value={form.narrative} onChange={e => set('narrative', e.target.value)} placeholder="Write as much as you need." />
          </div>

          <div className="tj-form-section">
            <div className="tj-private-panel">
              <div className="tj-private-label">Private — Notes to self</div>
              <textarea className="tj-form-textarea" value={form.notes_to_self} style={{ background: 'transparent', border: '1px solid rgba(231,76,60,.2)' }} onChange={e => set('notes_to_self', e.target.value)} placeholder="What are you not ready to say out loud yet?" />
            </div>
          </div>

          <div className="tj-form-footer">
            <button type="button" className="tj-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="tj-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save entry'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
