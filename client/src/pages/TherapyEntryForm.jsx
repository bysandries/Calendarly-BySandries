import { useState, useRef, useEffect } from 'react';
import { fetchTherapyPatterns } from '../utils/api/therapyJournal';

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
    dimension_assessments: {},
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
    goals: [], questions: [],
    dimension_assessments: initial.dimension_assessments || {},
    // For edit: pre-populate with currently linked patterns
    patterns: (initial.patterns || []).map(p => ({
      id: p.id, name: p.name, description: p.description,
      category: p.category, notes: p.entry_notes || null,
    })),
  };
}

// ── PatternSelector (exported so TherapyEntryNewPage can also use it) ─────────
const CAT_OPTIONS = [
  { value: 'attachment',              label: 'Attachment' },
  { value: 'emotion_regulation',      label: 'Emotion reg.' },
  { value: 'communication',           label: 'Communication' },
  { value: 'stress_response',         label: 'Stress Response' },
  { value: 'conflict_style',          label: 'Conflict Style' },
  { value: 'boundaries',              label: 'Boundaries' },
  { value: 'core_beliefs',            label: 'Core Beliefs' },
  { value: 'defense_mechanisms',      label: 'Defense Mechanisms' },
  { value: 'self_concept',            label: 'Self-Concept' },
  { value: 'interpersonal_patterns',  label: 'Interpersonal Patterns' },
  { value: 'trauma_responses',        label: 'Trauma Responses' },
  { value: 'love_languages',          label: 'Love Languages' },
  { value: 'differentiation',         label: 'Differentiation' },
  { value: 'internal_family_systems', label: 'Internal Family Systems' },
  { value: 'window_of_tolerance',     label: 'Window of Tolerance' },
  { value: 'other',                   label: 'Other' },
];

const DIMENSION_ASSESSMENTS = [
  { value: 'attachment',              label: 'Attachment' },
  { value: 'emotion_regulation',      label: 'Emotion Reg.' },
  { value: 'communication',           label: 'Communication' },
  { value: 'stress_response',         label: 'Stress Response' },
  { value: 'conflict_style',          label: 'Conflict Style' },
  { value: 'boundaries',              label: 'Boundaries' },
  { value: 'core_beliefs',            label: 'Core Beliefs' },
  { value: 'defense_mechanisms',      label: 'Defense Mechanisms' },
  { value: 'self_concept',            label: 'Self-Concept' },
  { value: 'interpersonal_patterns',  label: 'Interpersonal Patterns' },
  { value: 'trauma_responses',        label: 'Trauma Responses' },
  { value: 'love_languages',          label: 'Love Languages' },
  { value: 'differentiation',         label: 'Differentiation' },
  { value: 'internal_family_systems', label: 'IFS' },
  { value: 'window_of_tolerance',     label: 'Window of Tolerance' },
];

const RATING_OPTS = [1,2,3,4,5].map(v => ({ value: v, label: String(v) }));

export function PatternSelector({ selected, onChange }) {
  const [allPatterns, setAllPatterns] = useState([]);
  const [search,      setSearch]      = useState('');
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [newCat,      setNewCat]      = useState('other');

  useEffect(() => {
    fetchTherapyPatterns().then(setAllPatterns).catch(() => {});
  }, []);

  const selectedIds = new Set(selected.filter(p => p.id).map(p => p.id));

  const filtered = allPatterns.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
  });

  const toggle = (pattern) => {
    if (selectedIds.has(pattern.id)) {
      onChange(selected.filter(p => p.id !== pattern.id));
    } else {
      onChange([...selected, { id: pattern.id, name: pattern.name, description: pattern.description, category: pattern.category, notes: null }]);
    }
  };

  const removeNew = (idx) => {
    const news = selected.filter(p => !p.id);
    const existing = selected.filter(p => p.id);
    news.splice(idx, 1);
    onChange([...existing, ...news]);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const existing = selected.filter(p => p.id);
    const news     = selected.filter(p => !p.id);
    onChange([...existing, ...news, { name: newName.trim(), description: newDesc.trim() || null, category: newCat, notes: null }]);
    setNewName(''); setNewDesc(''); setNewCat('other'); setShowCreate(false);
  };

  const newPatterns = selected.filter(p => !p.id);

  return (
    <div className="tj-pattern-selector">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="tj-selected-patterns">
          {selected.map((p, i) => (
            <span key={p.id || `new-${i}`} className="tj-selected-pattern-chip" data-cat={p.category || 'other'}>
              {p.name}
              {!p.id && <span style={{ fontSize: 9, color: 'var(--accent, #FF6B9D)', marginLeft: 3 }}>new</span>}
              <button type="button" className="tj-chip-remove"
                onClick={() => p.id ? toggle(p) : removeNew(newPatterns.findIndex((n, ni) => n === p || (n.name === p.name && ni === i - selected.filter(x => x.id).length)))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + add */}
      <div className="tj-pattern-search-row">
        <input className="tj-pattern-search" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patterns…" />
        <button type="button" className="tj-btn-secondary"
          style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
          onClick={() => { setShowCreate(v => !v); setSearch(''); }}>
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="tj-ps-create-form">
          <input className="tj-list-input" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Pattern name (required)" autoFocus />
          <input className="tj-list-input" value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Short description (optional)" />
          <div className="tj-ps-cat-row">
            {CAT_OPTIONS.map(c => (
              <button key={c.value} type="button"
                className={`tj-ps-cat-btn${newCat === c.value ? ' sel' : ''}`}
                onClick={() => setNewCat(c.value)}>{c.label}</button>
            ))}
          </div>
          <button type="button" className="tj-btn-primary" style={{ alignSelf: 'flex-start' }}
            onClick={handleCreate} disabled={!newName.trim()}>
            Add pattern
          </button>
        </div>
      )}

      {/* Existing patterns list */}
      {!showCreate && (
        <div className="tj-pattern-selector-list">
          {filtered.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-dimmed)', textAlign: 'center', padding: '12px 0' }}>
              {search ? 'No matching patterns. Click "+ New" to create one.' : 'No patterns yet. Click "+ New" to create your first.'}
            </p>
          )}
          {filtered.map(p => {
            const isSelected = selectedIds.has(p.id);
            return (
              <div key={p.id} className={`tj-ps-item${isSelected ? ' selected' : ''}`} onClick={() => toggle(p)}>
                <div className="tj-ps-check">{isSelected ? '✓' : ''}</div>
                <div className="tj-ps-label">
                  <div className="tj-ps-name">{p.name}</div>
                  {p.description && <div className="tj-ps-desc">{p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}</div>}
                  <div className="tj-ps-cat">{(p.category || 'other').replace('_', ' ')}</div>
                </div>
                {p.occurrence_count > 0 && (
                  <span className="tj-ps-count">{p.occurrence_count}×</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [showDims, setShowDims] = useState(false);

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

          {/* ── Dimension Reflections ── */}
          <div className="tj-form-section">
            <label className="tj-form-label" style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowDims(v => !v)}>
              {showDims ? '▼' : '▶'} Dimension Reflections
              {!showDims && (
                <span style={{ fontSize: 11, color: 'var(--text-dimmed)', marginLeft: 6 }}>
                  ({Object.keys(form.dimension_assessments).filter(k => form.dimension_assessments[k]?.rating != null || form.dimension_assessments[k]?.note).length} assessed)
                </span>
              )}
            </label>
            {showDims && (
              <div style={{ marginTop: 8 }}>
                {DIMENSION_ASSESSMENTS.map(d => {
                  const val = form.dimension_assessments[d.value] || {};
                  return (
                    <div key={d.value} className="tj-dim-form-row">
                      <div className="tj-dim-form-header">
                        <span className="tj-dim-form-label" data-cat={d.value}>{d.label}</span>
                        <PillRow options={RATING_OPTS} value={val.rating ?? null}
                          onChange={v => set('dimension_assessments', {
                            ...form.dimension_assessments,
                            [d.value]: { ...val, rating: v }
                          })} />
                      </div>
                      <input className="tj-dim-form-note" value={val.note || ''}
                        onChange={e => set('dimension_assessments', {
                          ...form.dimension_assessments,
                          [d.value]: { ...val, note: e.target.value || null }
                        })} placeholder={`How is ${d.label.toLowerCase()} showing up?`} />
                    </div>
                  );
                })}
              </div>
            )}
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

          {/* Patterns */}
          <div className="tj-form-section">
            <label className="tj-form-label">Patterns</label>
            <PatternSelector
              selected={form.patterns}
              onChange={v => set('patterns', v)}
            />
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
