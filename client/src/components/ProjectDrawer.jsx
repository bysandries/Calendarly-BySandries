import { useState, useEffect, useCallback } from 'react';
import { fetchAreas, createProject as apiCreate, updateProject as apiUpdate, fetchTasks, updateTask } from '../utils/api';
import AreaPicker from './AreaPicker';
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
  person_in_charge: '',
  due_date: '',
  start_date: '',
  end_date: '',
};

export default function ProjectDrawer({ project, onSave, onDelete, onClose, onAreasChanged }) {
  const isOpen = project !== null;
  const isCreate = isOpen && !project?.id;

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [goalsInput, setGoalsInput] = useState('');
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
    if (!isOpen) return;
    if (isCreate) {
      setFormData(EMPTY_FORM);
      setGoalsInput('');
    } else {
      setFormData({
        title: project.title || '',
        status: project.status || 'active',
        area: project.area || 'general',
        pillar: project.pillar || 'Innovation',
        phase: project.phase || 'Plan',
        methodology: project.methodology || 'PALM',
        goals_aligned: project.goals_aligned || [],
        description: project.description || '',
        person_in_charge: project.person_in_charge || '',
        due_date: project.due_date || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
      });
      setGoalsInput((project.goals_aligned || []).join(', '));
    }
    setError('');
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!project?.id || assignSelected.size === 0) return;
    setAssignBusy(true);
    try {
      for (const taskId of assignSelected) {
        await updateTask(taskId, { project_id: project.id });
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
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const goals = goalsInput.split(',').map(s => s.trim()).filter(Boolean);
      const data = { ...formData, goals_aligned: goals };

      const result = isCreate
        ? await apiCreate(data)
        : await apiUpdate(project.id, data);

      onSave(result);
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

  // Computed stats (only in edit mode, data comes from parent project prop)
  const total = project?.total_tasks ?? 0;
  const done = project?.complete_tasks ?? 0;
  const pct = calcProgression(done, total);
  const importance = calcImportance(total);
  const remainingMins = project?.remaining_estimated_minutes ?? 0;
  const pomodoroMins = project?.pomodoro_minutes ?? 0;

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''}`}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-content glass-panel">

        {/* Header */}
        <div className="drawer-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="inline-edit"
              value={formData.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Project title…"
              style={{ fontSize: '1.2rem', fontWeight: 700, width: '100%' }}
            />
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
                status={formData.status}
                onChange={(s) => set('status', s)}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">Area</span>
              <AreaPicker
                value={formData.area}
                areas={areas}
                onSelect={(id) => set('area', id)}
                onAreasChanged={handleAreasChanged}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">Persons</span>
              <input
                className="form-input"
                value={formData.person_in_charge}
                onChange={(e) => set('person_in_charge', e.target.value)}
                placeholder="Responsible person"
                style={{ padding: '4px 10px', fontSize: '0.85rem' }}
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
                />
              </div>
              <div className="form-group">
                <label className="form-label">End</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: PALM / Pillar */}
          <div className="project-drawer-section">
            <div className="drawer-section-title">PALM Phase</div>
            <div className="palm-pill-grid">
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
                onChange={(e) => setGoalsInput(e.target.value)}
                placeholder="Build MVP, Ship v1, …"
              />
            </div>
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
          </div>

          {/* Section: Stats (read-only, edit mode only) */}
          {!isCreate && (
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
                    }[importance.cssClass] || 'var(--text-dimmed)',
                    fontWeight: 600,
                  }}>
                    {importance.label}
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
          {!isCreate && (
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
              onClick={() => onDelete(project)}
              disabled={busy}
            >
              {project?.status === 'archived' ? 'Delete' : 'Archive'}
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
