import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  fetchGoal,
  updateGoal,
  archiveGoal,
  completeGoal,
  deleteGoal,
  addGoalLink,
  deleteGoalLink,
} from '../utils/api/personalGoals';
import './TherapyJournal.css';
import './PersonalDashboard.css';

const SCOPE_LABELS = {
  personal:    'Personal Goals',
  short_term:  'Short Term (1 Month)',
  medium_term: 'Medium Term (6 Months)',
  long_term:   'Long Term (1 Year)',
};

function loadCustomScopeLabels() {
  try {
    const raw = localStorage.getItem('scope_labels');
    if (raw) return { ...SCOPE_LABELS, ...JSON.parse(raw) };
  } catch {}
  return { ...SCOPE_LABELS };
}

const SCOPE_COLORS = {
  personal:    '#FF6B9D',
  short_term:  '#3498DB',
  medium_term: '#F1C40F',
  long_term:   '#2ECC71',
};

const LINK_TYPE_LABELS = {
  extract: 'Extract',
  project: 'Project',
  task:    'Task',
  event:   'Calendar Event',
  note:    'Note',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function statusBadge(status) {
  if (status === 'completed') return { label: 'Completed', color: '#2ECC71' };
  if (status === 'archived')  return { label: 'Archived',  color: 'var(--text-dimmed)' };
  return { label: 'Active', color: '#FF6B9D' };
}

export default function PersonalGoalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [editingCompletionDate, setEditingCompletionDate] = useState(false);
  const [completionDateDraft, setCompletionDateDraft] = useState('');

  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [linkType, setLinkType] = useState('extract');
  const [linkId, setLinkId] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scopeLabels, setScopeLabels] = useState(loadCustomScopeLabels);

  const load = useCallback(() => {
    setLoading(true);
    fetchGoal(id)
      .then(g => { setGoal(g); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft.trim() === goal.title) {
      setEditingTitle(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateGoal(id, { title: titleDraft.trim() });
      setGoal(prev => ({ ...prev, ...updated }));
    } finally {
      setSaving(false);
      setEditingTitle(false);
    }
  }

  async function saveDate() {
    setSaving(true);
    try {
      const updated = await updateGoal(id, { creation_date: dateDraft });
      setGoal(prev => ({ ...prev, ...updated }));
    } finally {
      setSaving(false);
      setEditingDate(false);
    }
  }

  async function saveCompletionDate() {
    setSaving(true);
    try {
      const updated = await updateGoal(id, { completion_date: completionDateDraft || null });
      setGoal(prev => ({ ...prev, ...updated }));
    } finally {
      setSaving(false);
      setEditingCompletionDate(false);
    }
  }

  async function handleArchive() {
    setSaving(true);
    try {
      const updated = await archiveGoal(id);
      setGoal(prev => ({ ...prev, ...updated }));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      const updated = await completeGoal(id);
      setGoal(prev => ({ ...prev, ...updated }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteGoal(id);
      navigate(-1);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLink(e) {
    e.preventDefault();
    if (!linkId.trim()) return;
    setLinkSaving(true);
    try {
      const link = await addGoalLink(id, { link_type: linkType, link_id: linkId.trim(), notes: linkNotes.trim() || undefined });
      setGoal(prev => ({ ...prev, links: [...(prev.links || []), link] }));
      setLinkId('');
      setLinkNotes('');
      setAddLinkOpen(false);
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleRemoveLink(linkId_) {
    try {
      await deleteGoalLink(id, linkId_);
      setGoal(prev => ({ ...prev, links: (prev.links || []).filter(l => l.id !== linkId_) }));
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="tj-page">
        <div className="tj-page-topbar">
          <Link to="/personal-care" className="tj-topbar-back">Personal Care</Link>
          <span className="tj-topbar-sep">/</span>
          <span className="tj-topbar-title">Loading…</span>
        </div>
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="tj-page">
        <div className="tj-page-topbar">
          <Link to="/personal-care" className="tj-topbar-back">Personal Care</Link>
          <span className="tj-topbar-sep">/</span>
          <span className="tj-topbar-title">Goal not found</span>
        </div>
        <div className="tj-empty"><span>{error || 'Goal not found'}</span></div>
      </div>
    );
  }

  const badge     = statusBadge(goal.status);
  const scopeCol  = SCOPE_COLORS[goal.scope] || '#FF6B9D';
  const scopeLabel = scopeLabels[goal.scope] || goal.scope;
  const archiveHistory = goal.archive_history || [];
  const activationHistory = goal.activation_history || [];

  return (
    <div className="tj-page">
      {/* Top bar */}
      <div className="tj-page-topbar">
        <Link to="/personal-care" className="tj-topbar-back">Personal Care</Link>
        <span className="tj-topbar-sep">/</span>
        <span className="tj-topbar-title" style={{ color: scopeCol }}>{scopeLabel}</span>
        <div className="tj-topbar-actions">
          {goal.status !== 'completed' && (
            <button className="tj-btn-secondary" onClick={handleComplete} disabled={saving}>
              {goal.status === 'archived' ? '' : '✓ Complete'}
            </button>
          )}
          {goal.status === 'completed' && (
            <button className="tj-btn-secondary" onClick={handleComplete} disabled={saving}>
              Undo Complete
            </button>
          )}
          <button
            className="tj-btn-secondary"
            onClick={handleArchive}
            disabled={saving}
            style={goal.status === 'archived' ? { color: '#2ECC71' } : {}}
          >
            {goal.status === 'archived' ? 'Restore' : 'Archive'}
          </button>
          {!confirmDelete ? (
            <button className="tj-btn-secondary" onClick={() => setConfirmDelete(true)} disabled={saving}
              style={{ color: 'var(--accent-danger, #E74C3C)', borderColor: 'var(--accent-danger, #E74C3C)' }}>
              Delete
            </button>
          ) : (
            <button className="tj-btn-primary" onClick={handleDelete} disabled={saving}
              style={{ background: 'var(--accent-danger, #E74C3C)' }}>
              Confirm delete
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="tj-detail-scroll" style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: '860px' }}>
        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                style={{
                  flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '8px 12px', fontSize: '22px', fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              />
              <button className="tj-btn-primary" onClick={saveTitle} disabled={saving}>Save</button>
              <button className="tj-btn-secondary" onClick={() => setEditingTitle(false)}>Cancel</button>
            </div>
          ) : (
            <h1
              style={{ margin: 0, fontSize: '24px', fontWeight: 700, cursor: 'pointer', display: 'inline-block' }}
              title="Click to edit"
              onClick={() => { setTitleDraft(goal.title); setEditingTitle(true); }}
            >
              {goal.title}
            </h1>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <span style={{
            background: scopeCol + '22', color: scopeCol, border: `1px solid ${scopeCol}44`,
            borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600,
          }}>{scopeLabel}</span>

          <span style={{
            background: badge.color + '22', color: badge.color, border: `1px solid ${badge.color}44`,
            borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600,
          }}>{badge.label}</span>

          <span style={{ fontSize: '13px', color: 'var(--text-dimmed)' }}>
            Created:{' '}
            {editingDate ? (
              <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={dateDraft}
                  onChange={e => setDateDraft(e.target.value)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '2px 6px', fontSize: '12px', color: 'var(--text-primary)',
                  }}
                />
                <button className="tj-btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={saveDate} disabled={saving}>Save</button>
                <button className="tj-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={() => setEditingDate(false)}>Cancel</button>
              </span>
            ) : (
              <span
                style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: 'var(--text-secondary)' }}
                onClick={() => { setDateDraft(goal.creation_date || ''); setEditingDate(true); }}
                title="Click to edit"
              >
                {fmtDate(goal.creation_date)}
              </span>
            )}
          </span>

          {goal.completion_date && (
            <span style={{ fontSize: '13px', color: '#2ECC71' }}>
              Completed:{' '}
              {editingCompletionDate ? (
                <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={completionDateDraft}
                    onChange={e => setCompletionDateDraft(e.target.value)}
                    style={{
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: '4px', padding: '2px 6px', fontSize: '12px', color: 'var(--text-primary)',
                    }}
                  />
                  <button className="tj-btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={saveCompletionDate} disabled={saving}>Save</button>
                  <button className="tj-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => setEditingCompletionDate(false)}>Cancel</button>
                </span>
              ) : (
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: '#2ECC71' }}
                  onClick={() => { setCompletionDateDraft(goal.completion_date || ''); setEditingCompletionDate(true); }}
                  title="Click to edit"
                >
                  {fmtDate(goal.completion_date)}
                </span>
              )}
            </span>
          )}
          {goal.archived_at && goal.status === 'archived' && (
            <span style={{ fontSize: '13px', color: 'var(--text-dimmed)' }}>
              Archived: {fmtDate(goal.archived_at)}
            </span>
          )}
        </div>

        {/* Archive / Activation history */}
        {(archiveHistory.length > 0 || activationHistory.length > 0) && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {archiveHistory.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Archive History ({archiveHistory.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {archiveHistory.map((ts, i) => (
                    <span key={i} style={{
                      fontSize: '11px', background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: '4px', padding: '2px 8px', color: 'var(--text-dimmed)',
                    }}>
                      #{i + 1} — {fmtDate(ts.split(' ')[0])}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activationHistory.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#2ECC71', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Activation History ({activationHistory.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activationHistory.map((ts, i) => (
                    <span key={i} style={{
                      fontSize: '11px', background: 'rgba(46,204,113,.08)', border: '1px solid rgba(46,204,113,.2)',
                      borderRadius: '4px', padding: '2px 8px', color: '#2ECC71',
                    }}>
                      #{i + 1} — {fmtDate(ts.split(' ')[0])}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Links */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Linked Items {goal.links?.length > 0 && `(${goal.links.length})`}
            </p>
            <button className="tj-btn-secondary" onClick={() => setAddLinkOpen(v => !v)} style={{ fontSize: '11px', padding: '3px 10px' }}>
              {addLinkOpen ? 'Cancel' : '+ Add Link'}
            </button>
          </div>

          {addLinkOpen && (
            <form onSubmit={handleAddLink} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={linkType}
                  onChange={e => setLinkType(e.target.value)}
                  style={{
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '5px 8px', fontSize: '12px', color: 'var(--text-primary)',
                  }}
                >
                  {Object.entries(LINK_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <input
                  placeholder="ID or reference"
                  value={linkId}
                  onChange={e => setLinkId(e.target.value)}
                  style={{
                    flex: 1, minWidth: '160px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '5px 8px', fontSize: '12px', color: 'var(--text-primary)',
                  }}
                />
                <input
                  placeholder="Notes (optional)"
                  value={linkNotes}
                  onChange={e => setLinkNotes(e.target.value)}
                  style={{
                    flex: 2, minWidth: '160px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '5px 8px', fontSize: '12px', color: 'var(--text-primary)',
                  }}
                />
                <button className="tj-btn-primary" type="submit" disabled={linkSaving || !linkId.trim()}
                  style={{ padding: '5px 14px', fontSize: '12px' }}>
                  Add
                </button>
              </div>
            </form>
          )}

          {(!goal.links || goal.links.length === 0) && !addLinkOpen && (
            <p style={{ fontSize: '13px', color: 'var(--text-dimmed)', margin: 0 }}>
              No linked items yet. Link extracts, projects, tasks, or events to support this goal.
            </p>
          )}

          {goal.links && goal.links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {goal.links.map(link => (
                <div key={link.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '8px 12px', fontSize: '13px',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: '#3498DB',
                    background: '#3498DB22', borderRadius: '4px', padding: '1px 7px',
                  }}>
                    {LINK_TYPE_LABELS[link.link_type] || link.link_type}
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {link.link_id}
                  </span>
                  {link.notes && (
                    <span style={{ color: 'var(--text-dimmed)', fontSize: '12px', fontStyle: 'italic' }}>
                      {link.notes}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveLink(link.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-dimmed)', fontSize: '14px', padding: '0 2px',
                    }}
                    title="Remove link"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
