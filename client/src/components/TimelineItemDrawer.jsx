import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createTimelineItem, updateTimelineItem, deleteTimelineItem,
  fetchTimelineItem, addTimelineLink, deleteTimelineLink,
} from '../utils/api/timeline';
import { fetchProjects } from '../utils/api/projects';
import { fetchTasks } from '../utils/api/tasks';
import { fetchGoals } from '../utils/api/personalGoals';
import { LANES, TYPES, STATUSES, laneMeta } from '../utils/timelineConstants';

const COLOR_SWATCHES = ['#6366f1', '#3498DB', '#2ECC71', '#F1C40F', '#E67E22', '#FF6B9D', '#9B59B6', '#1ABC9C'];

function fmtStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRange(start, end) {
  const f = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
  return end ? `${f(start)} → ${f(end)}` : f(start);
}

const LINK_SOURCES = {
  project: { label: 'Project', fetch: fetchProjects, route: (id) => `/projects/${id}`, name: (o) => o.title || o.name },
  task:    { label: 'Task',    fetch: fetchTasks,    route: (id) => `/tasks/${id}`,    name: (o) => o.title },
  goal:    { label: 'Goal',    fetch: () => fetchGoals(), route: (id) => `/personal-care/goals/${id}`, name: (o) => o.title },
};

const EMPTY = {
  title: '', type: 'goal', lane: 'general', color: '',
  start_date: '', end_date: '', status: 'planned', progress: 0, notes: '',
};

export default function TimelineItemDrawer({ isOpen, item, onClose, onSaved, onDeleted }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [currentId, setCurrentId] = useState(null);
  const [links, setLinks] = useState([]);
  const [history, setHistory] = useState([]);
  const [linkType, setLinkType] = useState('project');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkOptions, setLinkOptions] = useState([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    const seed = { ...EMPTY, ...item, color: item.color || '' };
    setForm(seed);
    setCurrentId(item.id || null);
    setLinks([]);
    setHistory(item.version_history || []);
    setShowLinkPicker(false);
    setShowHistory(false);
    setLinkSearch('');
    if (item.id) {
      fetchTimelineItem(item.id)
        .then(full => { setLinks(full.links || []); setHistory(full.version_history || []); })
        .catch(() => {});
    }
  }, [isOpen, item]);

  // Load link candidates when the picker opens or its type changes
  useEffect(() => {
    if (!showLinkPicker) return;
    LINK_SOURCES[linkType].fetch()
      .then(rows => setLinkOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setLinkOptions([]));
  }, [showLinkPicker, linkType]);

  const escRef = useRef(onClose);
  escRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (isOpen && e.key === 'Escape') escRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const isMilestone = form.type === 'milestone';
  const isGoal = form.type === 'goal';

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        lane: form.lane,
        color: form.color || null,
        start_date: form.start_date,
        end_date: isMilestone ? null : (form.end_date || null),
        status: form.status,
        progress: isGoal ? Number(form.progress) || 0 : 0,
        notes: form.notes || null,
      };
      let saved;
      if (currentId) {
        saved = await updateTimelineItem(currentId, payload);
      } else {
        saved = await createTimelineItem(payload);
        setCurrentId(saved.id); // keep drawer open so links can be added
      }
      setHistory(saved.version_history || []);
      onSaved?.(saved);
    } catch (err) {
      console.error('Failed to save timeline item:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentId) { onClose(); return; }
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    try {
      await deleteTimelineItem(currentId);
      onDeleted?.(currentId);
      onClose();
    } catch (err) {
      console.error('Failed to delete timeline item:', err);
    }
  };

  const handleAddLink = async (linkId) => {
    if (!currentId) return;
    try {
      await addTimelineLink(currentId, { link_type: linkType, link_id: String(linkId) });
      const full = await fetchTimelineItem(currentId);
      setLinks(full.links || []);
      setLinkSearch('');
      setShowLinkPicker(false);
    } catch (err) {
      console.error('Failed to add link:', err);
    }
  };

  const handleRemoveLink = async (lnkId) => {
    try {
      await deleteTimelineLink(currentId, lnkId);
      setLinks(prev => prev.filter(l => l.id !== lnkId));
    } catch (err) {
      console.error('Failed to remove link:', err);
    }
  };

  const linkedIds = new Set(links.filter(l => l.link_type === linkType).map(l => String(l.link_id)));
  const filteredOptions = linkOptions.filter(o => {
    const nm = LINK_SOURCES[linkType].name(o) || '';
    return !linkedIds.has(String(o.id)) &&
      (linkSearch.trim() === '' || nm.toLowerCase().includes(linkSearch.toLowerCase()));
  });

  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-dimmed)', display: 'block', marginBottom: 5 };
  const fieldWrap = { marginBottom: 16 };

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''}`}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-content glass-panel">

        <div className="drawer-header">
          <input
            className="inline-edit"
            value={form.title}
            placeholder="What do you want to achieve?"
            onChange={e => set('title', e.target.value)}
            style={{ flex: 1, fontSize: '1.2rem', fontWeight: 700, background: 'transparent', border: 'none', color: 'var(--text-primary)' }}
            autoFocus
          />
          <button className="btn-close-drawer" type="button" onClick={onClose}>&times;</button>
        </div>

        <div className="drawer-body">
          {/* Type */}
          <div style={fieldWrap}>
            <span style={labelStyle}>Type</span>
            <div className="tl-filter-group">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`tl-filter-btn ${form.type === t.key ? 'active' : ''}`}
                  onClick={() => set('type', t.key)}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lane + Status */}
          <div style={{ display: 'flex', gap: 12, ...fieldWrap }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Life area</span>
              <select className="form-input" value={form.lane} onChange={e => set('lane', e.target.value)} style={{ width: '100%' }}>
                {LANES.map(l => <option key={l.key} value={l.key}>{l.emoji} {l.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Status</span>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: 12, ...fieldWrap }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>{isMilestone ? 'Date' : 'Start date'}</span>
              <input type="date" className="form-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={{ width: '100%' }} />
            </div>
            {!isMilestone && (
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>End date <span style={{ fontWeight: 400 }}>(optional)</span></span>
                <input type="date" className="form-input" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} style={{ width: '100%' }} />
              </div>
            )}
          </div>

          {/* Progress (goals only) */}
          {isGoal && (
            <div style={fieldWrap}>
              <span style={labelStyle}>Progress — {form.progress}%</span>
              <input type="range" min="0" max="100" value={form.progress} onChange={e => set('progress', e.target.value)} style={{ width: '100%' }} />
            </div>
          )}

          {/* Color */}
          <div style={fieldWrap}>
            <span style={labelStyle}>Color <span style={{ fontWeight: 400 }}>(optional — defaults to life area)</span></span>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              {COLOR_SWATCHES.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid var(--text-primary)' : '2px solid transparent' }} />
              ))}
              {form.color && (
                <button type="button" className="tl-filter-btn" onClick={() => set('color', '')} style={{ padding: '3px 9px' }}>Clear</button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div style={fieldWrap}>
            <span style={labelStyle}>Notes</span>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Why does this matter? What does success look like?"
              style={{ width: '100%', minHeight: 70, resize: 'vertical' }} />
          </div>

          {/* Linked items */}
          <div className="glass-panel" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>Linked items</h4>
              <button className="tl-filter-btn" type="button" disabled={!currentId}
                onClick={() => setShowLinkPicker(v => !v)} title={!currentId ? 'Save first to link items' : ''}>
                {showLinkPicker ? 'Cancel' : '+ Link'}
              </button>
            </div>

            {!currentId && <div style={{ fontSize: 11, color: 'var(--text-dimmed)' }}>Save this item first, then link projects, tasks, or goals.</div>}

            {showLinkPicker && currentId && (
              <div style={{ marginBottom: 10 }}>
                <div className="tl-filter-group" style={{ marginBottom: 8 }}>
                  {Object.entries(LINK_SOURCES).map(([k, v]) => (
                    <button key={k} type="button" className={`tl-filter-btn ${linkType === k ? 'active' : ''}`} onClick={() => setLinkType(k)}>{v.label}</button>
                  ))}
                </div>
                <input className="form-input" placeholder={`Search ${LINK_SOURCES[linkType].label.toLowerCase()}s…`}
                  value={linkSearch} onChange={e => setLinkSearch(e.target.value)} style={{ width: '100%', marginBottom: 8 }} autoFocus />
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                  {filteredOptions.length === 0 ? (
                    <div style={{ padding: 8, fontSize: 12, color: 'var(--text-dimmed)' }}>Nothing to link.</div>
                  ) : filteredOptions.slice(0, 40).map(o => (
                    <div key={o.id} onClick={() => handleAddLink(o.id)}
                      style={{ padding: '7px 11px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{LINK_SOURCES[linkType].name(o)}</span><span style={{ color: 'var(--text-dimmed)' }}>+</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.length === 0 && currentId && <div style={{ fontSize: 11, color: 'var(--text-dimmed)' }}>No linked items yet.</div>}
              {links.map(l => {
                const src = LINK_SOURCES[l.link_type];
                return (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>{l.link_type}</span>
                    <button type="button" onClick={() => src && navigate(src.route(l.link_id))}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--accent-primary, #6366f1)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                      Open {l.link_type} →
                    </button>
                    <button type="button" className="btn-icon btn-sm" onClick={() => handleRemoveLink(l.id)} style={{ padding: 2 }}>&times;</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="glass-panel" style={{ padding: 14, marginBottom: 8 }}>
              <button type="button" onClick={() => setShowHistory(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                ↻ Plan history ({history.length}) {showHistory ? '▾' : '▸'}
              </button>
              {showHistory && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((h, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-dimmed)', borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtStamp(h.changed_at)}</div>
                      <div>was: {fmtRange(h.start_date, h.end_date)} · {h.status}{h.progress ? ` · ${h.progress}%` : ''}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--accent-primary, #6366f1)', borderLeft: '2px solid var(--accent-primary, #6366f1)', paddingLeft: 10 }}>
                    <div style={{ fontWeight: 600 }}>now</div>
                    <div>{fmtRange(form.start_date, isMilestone ? null : form.end_date)} · {form.status}{isGoal ? ` · ${form.progress}%` : ''}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {currentId && (
            <button type="button" className="btn btn-danger btn-delete" onClick={handleDelete} style={{ marginRight: 'auto' }}>Delete</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title.trim() || !form.start_date}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
