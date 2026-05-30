import { useState, useEffect, useCallback } from 'react';
import { fetchAreas } from '../utils/api/areas';
import { createProject as apiCreate, updateProject as apiUpdate } from '../utils/api/projects';
import { fetchTasks, updateTask } from '../utils/api/tasks';
import AreaPicker from './AreaPicker';
import PersonPicker from './PersonPicker';
import ProjectStatusBadge from './ProjectStatusBadge';
import { calcProgression, calcImportance, formatDuration } from '../lib/taskMath';

const PALM_PHASES = ['Plan', 'Act', 'Measure', 'Learn', 'Ignored'];
const PILLARS = ['Kindness', 'Authenticity', 'Resilience', 'Innovation'];

const EMPTY_FORM = {
  title: '',
  status: 'active',
  area: 'general',
  pillar: 'Innovation',
  phase: 'Plan',
  methodology: 'PALM',
  goals_aligned: [],
  description: '',
  person_id: '',
  due_date: '',
  start_date: '',
  end_date: '',
};

export default function ProjectDrawer({ projects = [], onSave, onDelete, onClose, onAreasChanged }) {
  const isOpen = projects.length > 0;
  const isBulk = projects.length > 1;
  const isCreate = projects.length === 1 && !projects[0]?.id;
  const firstProject = projects[0] || {};

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [goalsInput, setGoalsInput] = useState('');
  const [changedFields, setChangedFields] = useState(new Set());
  const [areas, setAreas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Assign unassigned tasks panel
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignTasks, setAssignTasks] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSelected, setAssignSelected] = useState(new Set());
  const [assignBusy, setAssignBusy] = useState(false);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(console.error);
  }, []);

  useEffect(() => {
    setChangedFields(new Set());
    if (!isOpen) return;
    if (isCreate) {
      setFormData(EMPTY_FORM);
      setGoalsInput('');
    } else if (!isBulk) {
      setFormData({
        title: firstProject.title || '',
        status: firstProject.status || 'active',
        area: firstProject.area || 'general',
        pillar: firstProject.pillar || 'Innovation',
        phase: firstProject.phase || 'Plan',
        methodology: firstProject.methodology || 'PALM',
        goals_aligned: firstProject.goals_aligned || [],
        description: firstProject.description || '',
        person_id: firstProject.person_id || '',
        due_date: firstProject.due_date || '',
        start_date: firstProject.start_date || '',
        end_date: firstProject.end_date || '',
      });
      setGoalsInput((firstProject.goals_aligned || []).join(', '));
    } else {
      // Bulk mode: reset form to "no change" markers where appropriate
      setFormData({
        status: '', // empty means no change
        area: '',
        pillar: '',
        phase: '',
        methodology: '',
        goals_aligned: [],
        description: '',
        person_id: '',
        due_date: '',
        start_date: '',
        end_date: '',
      });
      setGoalsInput('');
    }
    setError('');
  }, [projects, isOpen, isCreate, isBulk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  useEffect(() => {
    function onKey(e) {
      if (isOpen && e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Reset assign panel when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setShowAssignPanel(false);
      setAssignSearch('');
      setAssignTasks([]);
      setAssignSelected(new Set());
    }
  }, [isOpen]);

  const fetchUnassignedTasks = useCallback(async (q = '') => {
    setAssignLoading(true);
    try {
      const data = await fetchTasks({ unassigned: 'true', q: q || undefined });
      setAssignTasks(data);
    } catch {
      setAssignTasks([]);
    } finally {
      setAssignLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showAssignPanel) fetchUnassignedTasks(assignSearch);
  }, [showAssignPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssignSearch = (e) => {
    setAssignSearch(e.target.value);
  };

  const handleAssignSearchSubmit = (e) => {
    if (e.key === 'Enter') fetchUnassignedTasks(assignSearch);
  };

  const toggleAssignSelect = (id) => {
    setAssignSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignToProject = async () => {
    if (!firstProject?.id || assignSelected.size === 0) return;
    setAssignBusy(true);
    try {
      for (const taskId of assignSelected) {
        await updateTask(taskId, { project_id: firstProject.id });
      }
      setAssignSelected(new Set());
      await fetchUnassignedTasks(assignSearch);
      if (onSave) onSave(null);
    } finally {
      setAssignBusy(false);
    }
  };

  function set(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (isBulk) setChangedFields(prev => new Set([...prev, field]));
  }

  function setGoals(value) {
    setGoalsInput(value);
    if (isBulk) setChangedFields(prev => new Set([...prev, 'goals_aligned']));
  }

  async function handleSave() {
    if (!isBulk && !isCreate && !formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (isCreate && !formData.title.trim()) {
      setError('Title is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (isCreate) {
        const goals = goalsInput.split(',').map(s => s.trim()).filter(Boolean);
        const result = await apiCreate({ ...formData, goals_aligned: goals });
        onSave(result);
      } else if (isBulk) {
        // Only send fields the user explicitly changed — title/description never in bulk
        const updates = {};
        for (const field of changedFields) {
          if (field === 'title' || field === 'description') continue;
          if (field === 'goals_aligned') {
            const goals = goalsInput.split(',').map(s => s.trim()).filter(Boolean);
            if (goals.length > 0) updates.goals_aligned = goals;
          } else {
            updates[field] = formData[field];
          }
        }
        for (const p of projects) {
          await apiUpdate(p.id, updates);
        }
        onSave(null);
      } else {
        // Single edit: send all fields
        const goals = goalsInput.split(',').map(s => s.trim()).filter(Boolean);
        const updates = { ...formData };
        if (goals.length > 0) updates.goals_aligned = goals;
        await apiUpdate(firstProject.id, updates);
        onSave(null);
      }
    } catch (e) {
      setError(e.message || 'Could not save project');
    } finally {
      setBusy(false);
    }
  }

  async function handleAreasChanged() {
    const updated = await fetchAreas();
    setAreas(updated);
    if (onAreasChanged) await onAreasChanged();
  }

  // Computed stats (only in single edit mode)
  const total = !isBulk ? firstProject?.total_tasks ?? 0 : 0;
  const done = !isBulk ? firstProject?.complete_tasks ?? 0 : 0;
  const pct = !isBulk ? calcProgression(done, total) : null;
  const importance = !isBulk ? calcImportance(total) : null;
  const remainingMins = !isBulk ? firstProject?.remaining_estimated_minutes ?? 0 : 0;
  const pomodoroMins = !isBulk ? firstProject?.pomodoro_minutes ?? 0 : 0;

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''} no-backdrop`}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-content glass-panel">

        {/* Header */}
        <div className="drawer-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            {isBulk ? (
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Editing {projects.length} Projects
                </h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Only fields you change here will be updated
                </p>
              </div>
            ) : (
              <input
                className="inline-edit"
                value={formData.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Project title…"
                style={{ fontSize: '1.2rem', fontWeight: 700, width: '100%' }}
              />
            )}
          </div>
          <button className="btn-close-drawer" type="button" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          {/* Section: Identity */}
          <div className="project-drawer-section">
            <div className="drawer-section-title">Identity</div>

            <div className="detail-row">
              <span className="detail-label">Status</span>
              <ProjectStatusBadge
                status={formData.status || (isBulk ? '' : 'active')}
                onChange={(s) => set('status', s)}
              />
              {isBulk && !formData.status && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>(No Change)</span>}
            </div>

            <div className="detail-row">
              <span className="detail-label">Area</span>
              <AreaPicker
                value={formData.area}
                areas={areas}
                onSelect={(id) => set('area', id)}
                onAreasChanged={handleAreasChanged}
                placeholder={isBulk ? '(No Change)' : 'Select Area'}
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
          </div>

          {/* Section: Timeline */}
          <div className="project-drawer-section">
            <div className="drawer-section-title">Timeline</div>
            <div className="project-drawer-date-grid">
              <div className="form-group">
                <label className="form-label">Start</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  placeholder={isBulk ? '(No Change)' : ''}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  placeholder={isBulk ? '(No Change)' : ''}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                  placeholder={isBulk ? '(No Change)' : ''}
                />
              </div>
            </div>
          </div>

          {/* Section: PALM / Pillar */}
          <div className="project-drawer-section">
            <div className="drawer-section-title">PALM Phase</div>
            <div className="palm-pill-grid">
              {isBulk && (
                <button
                  type="button"
                  className={`palm-phase ${!formData.phase ? 'active' : ''}`}
                  onClick={() => set('phase', '')}
                  style={{ fontSize: '0.7rem' }}
                >
                  (No Change)
                </button>
              )}
              {PALM_PHASES.map(phase => (
                <button
                  key={phase}
                  type="button"
                  className={`palm-phase ${phase.toLowerCase()} ${formData.phase === phase ? 'active' : ''}`}
                  onClick={() => set('phase', phase)}
                >
                  {phase}
                </button>
              ))}
            </div>

            <div className="drawer-section-title" style={{ marginTop: '14px' }}>Pillar</div>
            <div className="palm-pill-grid">
              {isBulk && (
                <button
                  type="button"
                  className={`palm-phase ${!formData.pillar ? 'active' : ''}`}
                  onClick={() => set('pillar', '')}
                  style={{ fontSize: '0.7rem' }}
                >
                  (No Change)
                </button>
              )}
              {PILLARS.map(pillar => (
                <button
                  key={pillar}
                  type="button"
                  className={`palm-phase ${formData.pillar === pillar ? 'active' : ''}`}
                  onClick={() => set('pillar', pillar)}
                >
                  {pillar}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Goals & Description */}
          <div className="project-drawer-section">
            <div className="drawer-section-title">Goals & Description</div>
            <div className="form-group">
              <label className="form-label">Goals aligned (comma-separated)</label>
              <input
                className="form-input"
                value={goalsInput}
                onChange={(e) => setGoals(e.target.value)}
                placeholder={isBulk ? '(unchanged if left blank)' : "Build MVP, Ship v1, …"}
              />
            </div>
            {!isBulk && (
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Project description…"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Section: Stats (read-only, edit mode only) */}
          {!isCreate && !isBulk && (
            <div className="project-drawer-section">
              <div className="drawer-section-title">Progress</div>
              <div className="project-drawer-stats">
                <div className="project-drawer-stat-row">
                  <span className="project-drawer-stat-label">Tasks</span>
                  <span className="project-drawer-stat-value">
                    {done} done / {total} total
                  </span>
                </div>
                <div className="project-drawer-stat-row">
                  <span className="project-drawer-stat-label">Progression</span>
                  <span className="project-drawer-stat-value">
                    {pct === null ? (
                      <span style={{ color: 'var(--text-dimmed)' }}>—</span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', display: 'inline-block' }}>
                          <span style={{
                            display: 'block',
                            width: `${pct}%`,
                            height: '100%',
                            background: pct === 100 ? '#2ECC71' : 'var(--accent-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease',
                          }} />
                        </span>
                        <span>{pct}%</span>
                      </span>
                    )}
                  </span>
                </div>
                <div className="project-drawer-stat-row">
                  <span className="project-drawer-stat-label">Importance</span>
                  <span className="project-drawer-stat-value" style={{
                    color: {
                      'importance-low': '#3498DB',
                      'importance-medium': '#E67E22',
                      'importance-high': '#E74C3C',
                      'importance-critical': '#8E44AD',
                    }[importance?.cssClass] || 'var(--text-dimmed)',
                    fontWeight: 600,
                  }}>
                    {importance?.label || '—'}
                  </span>
                </div>
                {remainingMins > 0 && (
                  <div className="project-drawer-stat-row">
                    <span className="project-drawer-stat-label">Est. remaining</span>
                    <span className="project-drawer-stat-value">{formatDuration(remainingMins)}</span>
                  </div>
                )}
                <div className="project-drawer-stat-row">
                  <span className="project-drawer-stat-label">Time invested</span>
                  <span className="project-drawer-stat-value" style={{ color: pomodoroMins > 0 ? 'var(--accent-primary)' : 'var(--text-dimmed)' }}>
                    {pomodoroMins > 0 ? formatDuration(pomodoroMins) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section: Assign Unassigned Tasks (edit mode only) */}
          {!isCreate && !isBulk && (
            <div className="project-drawer-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div className="drawer-section-title" style={{ marginBottom: 0 }}>Assign Tasks</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.72rem', padding: '2px 10px' }}
                  onClick={() => setShowAssignPanel(v => !v)}
                >
                  {showAssignPanel ? 'Hide' : 'Find unassigned →'}
                </button>
              </div>

              {showAssignPanel && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <input
                      className="form-input"
                      placeholder="Search tasks…"
                      value={assignSearch}
                      onChange={handleAssignSearch}
                      onKeyDown={handleAssignSearchSubmit}
                      style={{ flex: 1, padding: '4px 10px', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => fetchUnassignedTasks(assignSearch)}
                    >
                      Search
                    </button>
                  </div>

                  {assignLoading ? (
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', padding: '8px 0' }}>Loading…</div>
                  ) : assignTasks.length === 0 ? (
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', padding: '8px 0' }}>
                      No unassigned tasks found.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {assignTasks.map(task => (
                        <label
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-xs)',
                            cursor: 'pointer',
                            background: assignSelected.has(task.id) ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'transparent',
                            border: `1px solid ${assignSelected.has(task.id) ? 'var(--accent-primary)' : 'transparent'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            className="task-checkbox"
                            checked={assignSelected.has(task.id)}
                            onChange={() => toggleAssignSelect(task.id)}
                          />
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {task.status?.replace(/^\d+ - /, '') || ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {assignSelected.size > 0 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: '10px', width: '100%', fontSize: '0.82rem' }}
                      onClick={handleAssignToProject}
                      disabled={assignBusy}
                    >
                      {assignBusy ? 'Assigning…' : `Assign ${assignSelected.size} task${assignSelected.size !== 1 ? 's' : ''} to this project`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', padding: '0 0 8px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          {!isCreate && (
            <button
              type="button"
              className="btn btn-danger btn-delete"
              style={{ marginRight: 'auto' }}
              onClick={() => onDelete(isBulk ? projects : firstProject)}
              disabled={busy}
            >
              {isBulk ? 'Archive All' : (firstProject?.status === 'archived' ? 'Delete' : 'Archive')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : isCreate ? 'Create' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}
