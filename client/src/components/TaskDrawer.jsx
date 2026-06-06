import { useState, useEffect } from 'react';
import { GTD_STATUSES, getStatusInfo, PRIORITY_COLORS, PRIORITY_LABELS } from '../utils/statusMap';
import { calcDaysLeft, formatDaysLeft, calcUrgencyNotion } from '../lib/taskMath';
import PersonPicker from './PersonPicker';
import EnergyLogPanel from './EnergyLogPanel';

const FIELD_GRID = {
  display: 'grid',
  gridTemplateColumns: '90px 1fr',
  alignItems: 'center',
  gap: '8px 12px',
  minHeight: '36px',
};

const LABEL_STYLE = {
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const SECTION_CARD = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const SECTION_TITLE = {
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-dimmed)',
  marginBottom: '2px',
};

export default function TaskDrawer({ tasks, projects, areas, onSave, onDelete, onClose, mode = 'drawer' }) {
  const isOpen = tasks.length > 0;
  const isBulk = tasks.length > 1;
  const singleTask = !isBulk ? tasks[0] : null;

  const [formData, setFormData] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (!isBulk) {
      setFormData({
        title: singleTask.title || '',
        status: singleTask.status || '01 - Inbox',
        project_id: singleTask.project_id || '',
        priority: singleTask.priority || 0,
        date_due: singleTask.date_due || '',
        estimated_minutes: singleTask.estimated_minutes || 0,
        notes: singleTask.notes || '',
        is_starred: singleTask.is_starred || 0,
        person_id: singleTask.person_id || '',
        stage_week: singleTask.stage_week || '',
        categoria: singleTask.categoria || '',
      });
    } else {
      setFormData({
        status: '',
        project_id: '',
        priority: -1,
        date_due: '',
        estimated_minutes: '',
        is_starred: -1,
        person_id: '',
        stage_week: '',
        categoria: '',
      });
    }
  }, [tasks, isOpen, isBulk, singleTask]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setBusy(true);
    try {
      const updates = { ...formData };
      if (isBulk) {
        if (updates.priority === -1) delete updates.priority;
        if (updates.status === '') delete updates.status;
        if (updates.project_id === '') delete updates.project_id;
        if (updates.is_starred === -1) delete updates.is_starred;
        if (updates.person_id === '') delete updates.person_id;
      }
      for (const t of tasks) {
        const taskUpdates = { ...updates };
        if (isBulk) {
          delete taskUpdates.title;
          delete taskUpdates.notes;
        }
        await onSave(t.id, taskUpdates);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      for (const t of tasks) await onDelete(t.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const isInline = mode === 'inline';
  const currentStatusInfo = formData.status ? getStatusInfo(formData.status) : null;

  const daysLeft = calcDaysLeft(formData.date_due);
  const daysLeftLabel = formatDaysLeft(daysLeft);
  const urgency = calcUrgencyNotion({ date_due: formData.date_due, categoria: formData.categoria, status: formData.status });

  const isDuePast = formData.date_due && daysLeft !== null && daysLeft < 0;

  const content = (
    <div className="drawer-content glass-panel" style={isInline ? { width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden', transform: 'none', boxShadow: 'none' } : undefined}>

        {/* ── Header ── */}
        <div className="drawer-header" style={{ gap: '10px', padding: '18px 20px' }}>
          <button
            type="button"
            onClick={() => set('is_starred', formData.is_starred === 1 ? 0 : 1)}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              color: formData.is_starred === 1 ? '#F1C40F' : 'var(--text-dimmed)',
              opacity: formData.is_starred === -1 ? 0.4 : 1,
              padding: 0,
              lineHeight: 1,
              transition: 'color var(--transition-fast)',
            }}
            title={formData.is_starred === -1 ? 'Leave unchanged' : formData.is_starred ? 'Unstar' : 'Star'}
          >
            {formData.is_starred === 1 ? '★' : '☆'}
          </button>

          {isBulk ? (
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, flex: 1 }}>
              Editing {tasks.length} Tasks
            </h2>
          ) : (
            <input
              className="inline-edit"
              value={formData.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Task title…"
              style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1, minWidth: 0 }}
            />
          )}

          <button className="btn-close-drawer" type="button" onClick={onClose}>×</button>
        </div>

        {/* ── Body ── */}
        <div className="drawer-body" style={{ gap: '12px', padding: '16px 20px' }}>

          {/* Status & Priority */}
          <div style={SECTION_CARD}>
            <div style={SECTION_TITLE}>Status &amp; Priority</div>

            {/* Status pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {isBulk && (
                <button
                  type="button"
                  onClick={() => set('status', '')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${formData.status === '' ? 'var(--glass-border-active)' : 'var(--glass-border)'}`,
                    background: formData.status === '' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: formData.status === '' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  (No Change)
                </button>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {GTD_STATUSES.map(s => {
                  const info = getStatusInfo(s);
                  const isActive = formData.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        borderRadius: '20px',
                        border: `1px solid ${isActive ? info.color : 'var(--glass-border)'}`,
                        background: isActive ? `${info.color}22` : 'transparent',
                        color: isActive ? info.color : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: info.color,
                        flexShrink: 0,
                        boxShadow: isActive ? `0 0 6px ${info.color}` : 'none',
                      }} />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={LABEL_STYLE}>Priority</span>
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                {(isBulk ? [-1, 0, 1, 2, 3] : [0, 1, 2, 3]).map(p => {
                  const isActive = formData.priority === p;
                  const color = p === -1 ? 'var(--text-dimmed)' : PRIORITY_COLORS[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set('priority', p)}
                      title={p === -1 ? 'No Change' : PRIORITY_LABELS[p]}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        border: `2px solid ${isActive ? color : 'var(--glass-border)'}`,
                        background: p <= 0 ? (isActive ? 'rgba(255,255,255,0.08)' : 'transparent') : (isActive ? `${color}33` : 'transparent'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        boxShadow: isActive && p > 0 ? `0 0 8px ${color}66` : 'none',
                      }}
                    >
                      {p === -1 ? (
                        <span style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem' }}>—</span>
                      ) : (
                        <span style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: color,
                          boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Organization */}
          <div style={SECTION_CARD}>
            <div style={SECTION_TITLE}>Organization</div>

            {/* Project */}
            <div style={FIELD_GRID}>
              <span style={LABEL_STYLE}>Project</span>
              <select
                className="form-select"
                value={formData.project_id}
                onChange={(e) => set('project_id', e.target.value)}
                style={{ fontSize: '0.85rem', padding: '7px 32px 7px 10px' }}
              >
                {isBulk && <option value="">(No Change)</option>}
                <option value="none">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Due Date + ECT side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={LABEL_STYLE}>Due Date</span>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date_due}
                  onChange={(e) => set('date_due', e.target.value)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '7px 10px',
                    borderColor: isDuePast ? 'rgba(231,76,60,0.5)' : undefined,
                    color: isDuePast ? '#e74c3c' : undefined,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={LABEL_STYLE}>ECT (min)</span>
                <input
                  type="number"
                  className="form-input"
                  value={formData.estimated_minutes}
                  onChange={(e) => set('estimated_minutes', e.target.value)}
                  placeholder={isBulk ? '(No Change)' : '0'}
                  style={{ fontSize: '0.85rem', padding: '7px 10px' }}
                />
              </div>
            </div>

            {/* Days Left + Urgency — derived, read-only */}
            {!isBulk && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={LABEL_STYLE}>Days Left</span>
                  <div style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: daysLeft === null ? 'var(--text-dimmed)' :
                           daysLeft < 0 ? '#e74c3c' :
                           daysLeft === 0 ? '#e74c3c' :
                           daysLeft <= 3 ? '#F39C12' : 'var(--accent-success)',
                  }}>
                    {daysLeft === null ? '—' : daysLeftLabel}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={LABEL_STYLE}>Urgency</span>
                  <div style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}>
                    {urgency}
                  </div>
                </div>
              </div>
            )}

            {/* Person */}
            <div style={FIELD_GRID}>
              <span style={LABEL_STYLE}>Person</span>
              <PersonPicker
                value={formData.person_id}
                onSelect={(id) => set('person_id', id)}
                placeholder={isBulk ? '(No Change)' : 'Unassigned'}
              />
            </div>

            {/* Categoria */}
            <div style={FIELD_GRID}>
              <span style={LABEL_STYLE}>Categoría</span>
              <input
                className="form-input"
                value={formData.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                placeholder={isBulk ? '(No Change)' : 'e.g. EC Student'}
                style={{ fontSize: '0.85rem', padding: '7px 10px' }}
              />
            </div>

            {/* Stage / Week */}
            <div style={FIELD_GRID}>
              <span style={LABEL_STYLE}>Stage / Week</span>
              <input
                className="form-input"
                value={formData.stage_week}
                onChange={(e) => set('stage_week', e.target.value)}
                placeholder={isBulk ? '(No Change)' : 'e.g. Week 01 – April 6 to 12'}
                style={{ fontSize: '0.85rem', padding: '7px 10px' }}
              />
            </div>
          </div>

          {/* Notes */}
          {!isBulk && (
            <div style={SECTION_CARD}>
              <div style={SECTION_TITLE}>Notes</div>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Task description or notes…"
                rows={5}
                style={{ marginTop: 0, fontSize: '0.875rem', minHeight: '90px' }}
              />
            </div>
          )}

          {/* Energy Log */}
          {!isBulk && singleTask?.id && (
            <div style={SECTION_CARD}>
              <EnergyLogPanel entityType="task" entityId={singleTask.id} />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="drawer-footer">
          <button
            type="button"
            className="btn btn-danger btn-delete"
            style={{ marginRight: 'auto' }}
            onClick={handleDelete}
            disabled={busy}
          >
            Delete
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
  );

  if (isInline) {
    return <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>{content}</div>;
  }

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''} no-backdrop`}>
      <div className="drawer-backdrop" onClick={onClose} />
      {content}
    </div>
  );
}
