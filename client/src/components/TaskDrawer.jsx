import { useState, useEffect } from 'react';
import { GTD_STATUSES, getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';
import PersonPicker from './PersonPicker';
import EnergyLogPanel from './EnergyLogPanel';

export default function TaskDrawer({ tasks, projects, areas, onSave, onDelete, onClose }) {
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
      });
    } else {
      // Bulk initial state: empty or common values
      setFormData({
        status: '',
        project_id: '',
        priority: -1, // Use -1 to indicate "no change"
        date_due: '',
        estimated_minutes: '',
        is_starred: -1, // Use -1 for "no change"
        person_id: '', // Empty means "no change"
      });
    }
  }, [tasks, isOpen, isBulk, singleTask]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setBusy(true);
    try {
      const updates = { ...formData };
      
      // Clean up bulk updates (remove "no change" markers)
      if (isBulk) {
        if (updates.priority === -1) delete updates.priority;
        if (updates.status === '') delete updates.status;
        if (updates.project_id === '') delete updates.project_id;
        if (updates.is_starred === -1) delete updates.is_starred;
        if (updates.person_id === '') delete updates.person_id;
      }

      for (const t of tasks) {
        const taskUpdates = { ...updates };
        // Don't update title/notes in bulk
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
    if (confirm(`Delete ${isBulk ? tasks.length + ' tasks' : 'this task'}?`)) {
      setBusy(true);
      try {
        for (const t of tasks) {
          await onDelete(t.id);
        }
        onClose();
      } finally {
        setBusy(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''} no-backdrop`}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-content glass-panel">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => set('is_starred', formData.is_starred === 1 ? 0 : 1)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: formData.is_starred === 1 ? '#F1C40F' : 'var(--text-muted)',
                opacity: formData.is_starred === -1 ? 0.5 : 1,
                padding: 0,
                lineHeight: 1
              }}
              title={formData.is_starred === -1 ? "Leave unchanged" : formData.is_starred ? "Unstar" : "Star"}
            >
              {formData.is_starred === 1 ? '★' : '☆'}
            </button>
            {isBulk ? (
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Editing {tasks.length} Tasks</h2>
            ) : (
              <input
                className="inline-edit"
                value={formData.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Task title…"
                style={{ fontSize: '1.2rem', fontWeight: 700, width: '100%' }}
              />
            )}
          </div>
          <button className="btn-close-drawer" type="button" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          <div className="project-drawer-section">
            <div className="drawer-section-title">Status & Priority</div>
            
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {isBulk && <option value="">(No Change)</option>}
                {GTD_STATUSES.map(s => (
                  <option key={s} value={s}>{getStatusInfo(s).label}</option>
                ))}
              </select>
            </div>

            <div className="detail-row">
              <span className="detail-label">Priority</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(isBulk ? [-1, 0, 1, 2, 3] : [0, 1, 2, 3]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('priority', p)}
                    className={`priority-pill ${formData.priority === p ? 'active' : ''}`}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: formData.priority === p ? 'var(--text-primary)' : 'transparent',
                      background: p === -1 ? 'var(--bg-card)' : p === 0 ? 'var(--bg-card)' : PRIORITY_COLORS[p],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                  >
                    {p === -1 ? '—' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="project-drawer-section">
            <div className="drawer-section-title">Organization</div>
            
            <div className="detail-row">
              <span className="detail-label">Project</span>
              <select
                className="form-select"
                value={formData.project_id}
                onChange={(e) => set('project_id', e.target.value)}
              >
                {isBulk && <option value="">(No Change)</option>}
                <option value="none">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div className="detail-row">
              <span className="detail-label">Due Date</span>
              <input
                type="date"
                className="form-input"
                value={formData.date_due}
                onChange={(e) => set('date_due', e.target.value)}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">Person</span>
              <PersonPicker
                value={formData.person_id}
                onSelect={(id) => set('person_id', id)}
                placeholder={isBulk ? '(No Change)' : 'Unassigned'}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">ECT (min)</span>
              <input
                type="number"
                className="form-input"
                value={formData.estimated_minutes}
                onChange={(e) => set('estimated_minutes', e.target.value)}
                placeholder={isBulk ? '(No Change)' : '0'}
              />
            </div>
          </div>

          {!isBulk && (
            <div className="project-drawer-section">
              <div className="drawer-section-title">Notes</div>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Task description or notes…"
                rows={6}
                style={{ width: '100%', marginTop: '8px' }}
              />
            </div>
          )}

          {!isBulk && singleTask?.id && (
            <div className="project-drawer-section">
              <EnergyLogPanel entityType="task" entityId={singleTask.id} />
            </div>
          )}
        </div>

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
    </div>
  );
}
