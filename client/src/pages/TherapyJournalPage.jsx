import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTherapyJournal } from '../hooks/useTherapyJournal';
import {
  createTherapyEntry, fetchTherapyEntries, fetchTherapyPatterns,
  fetchQuickEntries, createQuickEntry, updateQuickEntry, deleteQuickEntry,
  updateTherapyEntry,
} from '../utils/api/therapyJournal';
import './TherapyJournal.css';

// ── Topic definitions ─────────────────────────────────────────────────────────
const TOPICS = [
  { id: 'feeling',     label: 'Feeling',     color: '#FF6B9D', icon: '💭' },
  { id: 'thought',     label: 'Thought',     color: '#3498DB', icon: '🧠' },
  { id: 'memory',      label: 'Memory',      color: '#9B59B6', icon: '💾' },
  { id: 'observation', label: 'Observation', color: '#2ECC71', icon: '👁' },
  { id: 'question',    label: 'Question',    color: '#F1C40F', icon: '❓' },
  { id: 'pattern',     label: 'Pattern',     color: '#E74C3C', icon: '🔄' },
  { id: 'win',         label: 'Win',         color: '#1ABC9C', icon: '✨' },
  { id: 'fear',        label: 'Fear',        color: '#E67E22', icon: '😰' },
  { id: 'trigger',     label: 'Trigger',     color: '#95A5A6', icon: '⚡' },
  { id: 'gratitude',   label: 'Gratitude',   color: '#27AE60', icon: '🙏' },
];

const topicMap = Object.fromEntries(TOPICS.map(t => [t.id, t]));

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return {};
  const dt = new Date(d + 'T12:00:00');
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day:   dt.getDate(),
    year:  dt.getFullYear(),
  };
}
function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.round((now - d) / 60000);
  if (diff < 1)   return 'just now';
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function moodColor(v) {
  if (!v) return 'var(--text-dimmed)';
  if (v >= 7) return '#2ECC71';
  if (v >= 5) return '#F1C40F';
  return '#E74C3C';
}
function moodEmoji(v) {
  if (!v) return null;
  if (v >= 8) return '😊';
  if (v >= 6) return '🙂';
  if (v >= 4) return '😶';
  if (v >= 2) return '😔';
  return '😞';
}
function sleepDotColor(v) { return v <= 1 ? 'red' : v <= 2 ? 'yellow' : 'green'; }
function moodDotColor(v)  { return v <= 3 ? 'red' : v <= 6 ? 'yellow' : 'green'; }

function MiniDots({ value, max, colorFn }) {
  return (
    <div className="tj-mini-dots">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`tj-mini-dot${i < value ? ` on ${colorFn ? colorFn(value) : ''}` : ''}`} />
      ))}
    </div>
  );
}

// ── Pattern Card (large, for Patterns tab) ────────────────────────────────────
function PatternCardLg({ pattern }) {
  return (
    <Link
      to={`/personal-care/journal/pattern/${pattern.id}`}
      className="tj-pattern-card-lg"
      data-cat={pattern.category || 'other'}
    >
      <div className="tj-pcl-header">
        <span className="tj-pcl-name">{pattern.name}</span>
        <span className="tj-pattern-cat-badge" data-cat={pattern.category || 'other'}>
          {(pattern.category || 'other').replace('_', ' ')}
        </span>
      </div>
      {pattern.description && <p className="tj-pcl-desc">{pattern.description}</p>}
      <div className="tj-pcl-footer">
        <span className="tj-pcl-count">
          {pattern.occurrence_count || 0} {pattern.occurrence_count === 1 ? 'entry' : 'entries'}
        </span>
        <span className="tj-pcl-link">View entries →</span>
      </div>
    </Link>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────
function EntryCard({ e, archived, onUnarchive }) {
  const { month, day, year } = fmtDate(e.entry_date);
  const mood  = e.state?.mood;
  const sleep = e.state?.sleep_quality;
  const eat   = e.state?.eating;
  return (
    <div style={{ position: 'relative' }}>
      <Link to={`/personal-care/journal/${e.id}`} className={`tj-card${archived ? ' archived' : ''}`}>
        <div className="tj-card-date-badge">
          <span className="tj-card-month">{month}</span>
          <span className="tj-card-day">{day}</span>
          <span className="tj-card-year">{year}</span>
        </div>
        <div className="tj-card-body">
          <div className="tj-card-label">{e.session_label || 'Untitled entry'}</div>
          {e.context && <div className="tj-card-context">{e.context}</div>}
          <div className="tj-card-chips">
            {mood != null && (
              <span className="tj-chip-mood" style={{ color: moodColor(mood), background: `color-mix(in srgb, ${moodColor(mood)} 12%, transparent)`, padding: '2px 8px', borderRadius: 999 }}>
                {moodEmoji(mood)} {mood}/10
              </span>
            )}
            {e.pattern_count > 0 && <span className="tj-chip">{e.pattern_count} pattern{e.pattern_count !== 1 ? 's' : ''}</span>}
            {e.open_question_count > 0 && <span className="tj-chip">{e.open_question_count} open Q</span>}
            {e.linked_sleep?.length > 0 && <span className="tj-chip">💤 {e.linked_sleep.length} night{e.linked_sleep.length !== 1 ? 's' : ''}</span>}
            {e.linked_habits?.length > 0 && <span className="tj-chip">🔁 {e.linked_habits.length} habit{e.linked_habits.length !== 1 ? 's' : ''}</span>}
            {archived && <span className="tj-chip" style={{ color: 'var(--text-dimmed)' }}>Archived</span>}
          </div>
        </div>
        <div className="tj-card-dots">
          {sleep != null && (
            <div>
              <div className="tj-mini-dot-label">Sleep</div>
              <MiniDots value={sleep} max={5} colorFn={sleepDotColor} />
            </div>
          )}
          {mood != null && (
            <div>
              <div className="tj-mini-dot-label">Mood</div>
              <MiniDots value={Math.round(mood / 2)} max={5} colorFn={moodDotColor} />
            </div>
          )}
          {eat != null && (
            <div>
              <div className="tj-mini-dot-label">Eat</div>
              <MiniDots value={eat} max={5} colorFn={sleepDotColor} />
            </div>
          )}
        </div>
      </Link>
      {archived && onUnarchive && (
        <button className="tj-unarchive-btn"
          style={{ position: 'absolute', top: 12, right: 12 }}
          onClick={e2 => { e2.preventDefault(); onUnarchive(e.id); }}>
          Unarchive
        </button>
      )}
    </div>
  );
}

// ── Quick card ────────────────────────────────────────────────────────────────
function QuickCard({ q, onArchive, onDelete }) {
  const topic = topicMap[q.topic] || { label: q.topic, color: 'var(--text-dimmed)', icon: '📝' };
  return (
    <div className="tj-quick-card" style={{ borderTopColor: topic.color }}>
      <div className="tj-quick-card-topic" style={{ color: topic.color }}>
        {topic.icon} {topic.label}
      </div>
      <div className="tj-quick-card-title">{q.title}</div>
      {q.description && <div className="tj-quick-card-desc">{q.description}</div>}
      <div className="tj-quick-card-time">{fmtRelative(q.created_at)}</div>
      <div className="tj-quick-card-actions">
        <button className="tj-quick-card-btn" onClick={() => onArchive(q.id)}>Archive</button>
        <button className="tj-quick-card-btn danger" onClick={() => onDelete(q.id)}>Delete</button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TherapyJournalPage() {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);

  const [tab,       setTab]       = useState('entries'); // entries | patterns | archived
  const [entries,   setEntries]   = useState([]);
  const [archived,  setArchived]  = useState([]);
  const [patterns,  setPatterns]  = useState([]);
  const [quickList, setQuickList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  // Quick capture state
  const [activeTopic,  setActiveTopic]  = useState(null); // topic id
  const [quickTitle,   setQuickTitle]   = useState('');
  const [quickDesc,    setQuickDesc]    = useState('');
  const [savingQuick,  setSavingQuick]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, p, q] = await Promise.all([
        fetchTherapyEntries(),
        fetchTherapyPatterns(),
        fetchQuickEntries(),
      ]);
      setEntries(e);
      setPatterns(p);
      setQuickList(q);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load archived entries only when that tab is active
  const loadArchived = useCallback(async () => {
    try {
      const a = await fetchTherapyEntries({ archived: 1 });
      setArchived(a);
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'archived') loadArchived();
  }, [tab, loadArchived]);

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.__type !== 'calendarly-therapy-entry') {
        setImportMsg({ type: 'error', text: 'Invalid file — not a Calendarly therapy entry.' });
        return;
      }
      const { createTherapyEntry: create } = await import('../utils/api/therapyJournal');
      const payload = {
        entry_date:        data.entry_date        || new Date().toISOString().split('T')[0],
        session_date:      data.session_date       || null,
        session_label:     data.session_label      || null,
        context:           data.context            || null,
        therapist_summary: data.therapist_summary  || null,
        narrative:         data.narrative          || null,
        notes_to_self:     data.notes_to_self      || null,
        state:             data.state              || null,
        actions_taken:     data.actions_taken      || [],
        reply_drafts:      data.reply_drafts       || [],
        linked_sleep:      data.linked_sleep       || [],
        linked_habits:     data.linked_habits      || [],
        patterns:  (data.patterns  || []).filter(p => p.name),
        goals:     (data.goals     || []).filter(g => g.text),
        questions: (data.questions || []).filter(q => q.text),
      };
      const entry = await create(payload);
      navigate(`/personal-care/journal/${entry.id}`);
    } catch (err) {
      setImportMsg({ type: 'error', text: err instanceof SyntaxError ? 'Invalid JSON file.' : (err.message || 'Import failed.') });
    } finally { setImporting(false); }
  };

  // ── Quick capture ───────────────────────────────────────────────────────────
  const handleTopicClick = (topicId) => {
    if (activeTopic === topicId) { setActiveTopic(null); setQuickTitle(''); setQuickDesc(''); return; }
    setActiveTopic(topicId);
    setQuickTitle('');
    setQuickDesc('');
  };

  const handleQuickSave = async () => {
    if (!quickTitle.trim() || !activeTopic) return;
    setSavingQuick(true);
    try {
      const q = await createQuickEntry({ topic: activeTopic, title: quickTitle.trim(), description: quickDesc.trim() || null });
      setQuickList(prev => [q, ...prev]);
      setActiveTopic(null); setQuickTitle(''); setQuickDesc('');
    } finally { setSavingQuick(false); }
  };

  const handleArchiveQuick = async (id) => {
    await updateQuickEntry(id, { is_archived: true });
    setQuickList(prev => prev.filter(q => q.id !== id));
  };

  const handleDeleteQuick = async (id) => {
    await deleteQuickEntry(id);
    setQuickList(prev => prev.filter(q => q.id !== id));
  };

  // ── Unarchive full entry ────────────────────────────────────────────────────
  const handleUnarchive = async (id) => {
    await updateTherapyEntry(id, { is_archived: 0 });
    setArchived(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="tj-page">
      {/* Top bar */}
      <div className="tj-page-topbar">
        <Link to="/personal-care" className="tj-topbar-back">← Personal Care</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title">Therapy Journal</span>
        <div className="tj-topbar-actions">
          <input ref={fileRef} type="file" accept=".json,application/json"
            style={{ display: 'none' }} onChange={handleImport} />
          <button className="tj-btn-secondary"
            onClick={() => fileRef.current?.click()} disabled={importing}
            title="Import a previously exported JSON entry">
            {importing ? 'Importing…' : 'Import ↑'}
          </button>
          <button className="tj-btn-primary" onClick={() => navigate('/personal-care/journal/new')}>+ New Entry</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tj-list-tabs">
        {[
          { id: 'entries',  label: `Entries${entries.length ? ` (${entries.length})` : ''}` },
          { id: 'patterns', label: `Patterns${patterns.length ? ` (${patterns.length})` : ''}` },
          { id: 'archived', label: 'Archived' },
        ].map(t => (
          <button key={t.id}
            className={`tj-list-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Import feedback */}
      {importMsg && (
        <div style={{ margin: '10px 20px 0', padding: '9px 14px', borderRadius: 7, fontSize: 13,
          background: importMsg.type === 'ok' ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)',
          color: importMsg.type === 'ok' ? '#2ECC71' : '#E74C3C',
          border: `1px solid ${importMsg.type === 'ok' ? 'rgba(46,204,113,.3)' : 'rgba(231,76,60,.3)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── ENTRIES TAB ───────────────────────────────────────────────────── */}
      {tab === 'entries' && (
        <div className="tj-entries-layout">
          {/* Left column — entry list (2/3) */}
          <div className="tj-entries-main">
            <div className="tj-list-body">
              {error && <p style={{ color: 'var(--accent-danger)', fontSize: 13 }}>{error}</p>}
              {loading ? (
                <div className="tj-empty"><span style={{ color: 'var(--text-dimmed)', fontSize: 13 }}>Loading…</span></div>
              ) : entries.length === 0 ? (
                <div className="tj-empty">
                  <span className="tj-empty-icon">📓</span>
                  <span>No entries yet. Create your first one.</span>
                  <button className="tj-btn-primary" onClick={() => navigate('/personal-care/journal/new')}>+ New Entry</button>
                </div>
              ) : (
                <div className="tj-list-grid">
                  {entries.map(e => <EntryCard key={e.id} e={e} />)}
                </div>
              )}
            </div>
          </div>

          {/* Right column — quick notes (1/3) */}
          <div className="tj-quick-sidebar">
            <div className="tj-quick-section">
              <div className="tj-quick-section-label">Quick Capture</div>
              <div className="tj-quick-topics">
                {TOPICS.map(t => (
                  <button key={t.id}
                    className={`tj-quick-topic-btn${activeTopic === t.id ? ' active' : ''}`}
                    onClick={() => handleTopicClick(t.id)}
                    style={{ '--topic-color': t.color }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {activeTopic && (
                <div className="tj-quick-form">
                  <div style={{ fontSize: 11, color: topicMap[activeTopic]?.color, fontWeight: 700, marginBottom: 2 }}>
                    {topicMap[activeTopic]?.icon} {topicMap[activeTopic]?.label}
                  </div>
                  <input autoFocus className="tj-quick-input" value={quickTitle}
                    onChange={e => setQuickTitle(e.target.value)}
                    placeholder="What's on your mind?"
                    onKeyDown={e => e.key === 'Escape' && (setActiveTopic(null), setQuickTitle(''), setQuickDesc(''))}
                  />
                  <textarea className="tj-quick-textarea" value={quickDesc}
                    onChange={e => setQuickDesc(e.target.value)}
                    placeholder="Add more detail… (optional)"
                    rows={2}
                  />
                  <div className="tj-quick-form-row">
                    <button className="tj-btn-primary" onClick={handleQuickSave}
                      disabled={savingQuick || !quickTitle.trim()}>
                      {savingQuick ? 'Saving…' : 'Save'}
                    </button>
                    <button className="tj-btn-secondary"
                      onClick={() => { setActiveTopic(null); setQuickTitle(''); setQuickDesc(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Quick entry cards */}
              {quickList.length > 0 && (
                <div className="tj-quick-entries">
                  {quickList.map(q => (
                    <QuickCard key={q.id} q={q}
                      onArchive={handleArchiveQuick}
                      onDelete={handleDeleteQuick} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PATTERNS TAB ──────────────────────────────────────────────────── */}
      {tab === 'patterns' && (
        <div className="tj-list-body">
          {patterns.length === 0 ? (
            <div className="tj-empty">
              <span className="tj-empty-icon">🔄</span>
              <span>No patterns yet. Add patterns when creating or editing a journal entry.</span>
            </div>
          ) : (
            <div className="tj-list-grid">
              {patterns.map(p => <PatternCardLg key={p.id} pattern={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ── ARCHIVED TAB ──────────────────────────────────────────────────── */}
      {tab === 'archived' && (
        <div className="tj-list-body">
          <div className="tj-archived-header">
            <span>Archived entries are hidden from the main view. Unarchive to restore.</span>
          </div>
          {archived.length === 0 ? (
            <div className="tj-empty">
              <span className="tj-empty-icon">🗂</span>
              <span>No archived entries.</span>
            </div>
          ) : (
            <div className="tj-list-grid">
              {archived.map(e => (
                <EntryCard key={e.id} e={e} archived onUnarchive={handleUnarchive} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
