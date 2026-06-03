import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas } from '../utils/api/areas';
import PomodoroPanel from '../components/PomodoroPanel';
import PersonPicker from '../components/PersonPicker';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import { GTD_STATUSES, getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';
import { calcDaysLeft, formatDaysLeft, calcProgression, calcImportance, formatDuration } from '../lib/taskMath';

const PALM_PHASES = ['Plan', 'Act', 'Measure', 'Learn', 'Ignored'];
const PILLARS = ['Kindness', 'Authenticity', 'Resilience', 'Innovation'];
const IMPORTANCE_COLORS = {
  'importance-low':      '#3498DB',
  'importance-medium':   '#E67E22',
  'importance-high':     '#E74C3C',
  'importance-critical': '#8E44AD',
};

// ── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 6px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dimmed)' }}>
        {count}
      </span>
    </div>
  );
}

function TaskRow({ task, projects, isSelected, onClick }) {
  const project = projects.find(p => p.id === task.project_id);
  const status = getStatusInfo(task.status);
  const daysLeft = calcDaysLeft(task.date_due);
  const priorityColor = PRIORITY_COLORS[task.priority] ?? 'var(--text-dimmed)';
  const overdue = task.date_due && daysLeft < 0;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: priorityColor, fontSize: '9px', flexShrink: 0 }}>●</span>
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {project && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </span>
      )}
      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: status.color ?? 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {status.label}
      </span>
      {task.date_due && (
        <span style={{ fontSize: '11px', color: overdue ? 'var(--danger, #e74c3c)' : 'var(--text-dimmed)', flexShrink: 0 }}>
          {formatDaysLeft(daysLeft)}
        </span>
      )}
    </div>
  );
}

function ProjectRow({ project, isSelected, onClick }) {
  const total = project.total_tasks ?? 0;
  const done = project.complete_tasks ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {project.phase && (
        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(52,152,219,0.1)', color: 'var(--accent-primary)', flexShrink: 0 }}>
          {project.phase}
        </span>
      )}
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.title}
      </span>
      {total > 0 && (
        <div style={{ width: '48px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#2ecc71' : 'var(--accent-primary)', borderRadius: '2px' }} />
        </div>
      )}
      <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', flexShrink: 0, width: '28px', textAlign: 'right' }}>
        {total > 0 ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

// ── Inline task detail panel ─────────────────────────────────────────────────

function TaskPanel({ task, projects, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      title:              task.title || '',
      status:             task.status || '01 - Inbox',
      project_id:         task.project_id || '',
      priority:           task.priority ?? 0,
      date_due:           task.date_due || '',
      estimated_minutes:  task.estimated_minutes || '',
      notes:              task.notes || '',
      is_starred:         task.is_starred || 0,
      person_id:          task.person_id || '',
    });
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setBusy(true);
    try { await onSave(task.id, form); onClose(); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try { await onDelete(task.id); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => set('is_starred', form.is_starred === 1 ? 0 : 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0, color: form.is_starred === 1 ? '#F1C40F' : 'var(--text-muted)', flexShrink: 0 }}
          >
            {form.is_starred === 1 ? '★' : '☆'}
          </button>
          <input
            className="inline-edit"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Task title…"
            style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '0 2px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="project-drawer-section">
          <div className="drawer-section-title">Status &amp; Priority</div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {GTD_STATUSES.map(s => (
                <option key={s} value={s}>{getStatusInfo(s).label}</option>
              ))}
            </select>
          </div>
          <div className="detail-row">
            <span className="detail-label">Priority</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[0, 1, 2, 3].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer',
                    border: `2px solid ${form.priority === p ? 'var(--text-primary)' : 'transparent'}`,
                    background: p === 0 ? 'var(--bg-card)' : PRIORITY_COLORS[p],
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="project-drawer-section">
          <div className="drawer-section-title">Organization</div>
          <div className="detail-row">
            <span className="detail-label">Project</span>
            <select className="form-select" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
              <option value="">No Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <span className="detail-label">Due</span>
            <input type="date" className="form-input" value={form.date_due} onChange={e => set('date_due', e.target.value)} />
          </div>
          <div className="detail-row">
            <span className="detail-label">Person</span>
            <PersonPicker value={form.person_id} onSelect={id => set('person_id', id)} placeholder="Unassigned" />
          </div>
          <div className="detail-row">
            <span className="detail-label">ECT (min)</span>
            <input type="number" className="form-input" value={form.estimated_minutes} onChange={e => set('estimated_minutes', e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="project-drawer-section">
          <div className="drawer-section-title">Notes</div>
          <textarea
            className="form-textarea"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Notes…"
            rows={5}
            style={{ width: '100%', marginTop: '6px' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button type="button" className="btn btn-danger btn-delete" onClick={handleDelete} disabled={busy} style={{ marginRight: 'auto', fontSize: '12px' }}>
          Delete
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} style={{ fontSize: '12px' }}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy} style={{ fontSize: '12px' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Inline project detail panel ──────────────────────────────────────────────

function ProjectPanel({ project, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      title:       project.title || '',
      status:      project.status || 'active',
      phase:       project.phase || 'Plan',
      pillar:      project.pillar || 'Innovation',
      due_date:    project.due_date || '',
      description: project.description || '',
    });
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setBusy(true);
    try { await onSave(project.id, form); onClose(); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try { await onDelete(project.id); }
    finally { setBusy(false); }
  };

  const total = project.total_tasks ?? 0;
  const done  = project.complete_tasks ?? 0;
  const pct   = calcProgression(done, total);
  const importance    = calcImportance(total);
  const remainingMins = project.remaining_estimated_minutes ?? 0;
  const pomodoroMins  = project.pomodoro_minutes ?? 0;

  return (
    <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            className="inline-edit"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Project title…"
            style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '0 2px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="project-drawer-section">
          <div className="drawer-section-title">Identity</div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <ProjectStatusBadge status={form.status} onChange={s => set('status', s)} />
          </div>
          <div className="detail-row">
            <span className="detail-label">Due</span>
            <input type="date" className="form-input" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>

        <div className="project-drawer-section">
          <div className="drawer-section-title">PALM Phase</div>
          <div className="palm-pill-grid">
            {PALM_PHASES.map(phase => (
              <button
                key={phase}
                type="button"
                className={`palm-phase ${phase.toLowerCase()} ${form.phase === phase ? 'active' : ''}`}
                onClick={() => set('phase', phase)}
              >
                {phase}
              </button>
            ))}
          </div>
          <div className="drawer-section-title" style={{ marginTop: '12px' }}>Pillar</div>
          <div className="palm-pill-grid">
            {PILLARS.map(pillar => (
              <button
                key={pillar}
                type="button"
                className={`palm-phase ${form.pillar === pillar ? 'active' : ''}`}
                onClick={() => set('pillar', pillar)}
              >
                {pillar}
              </button>
            ))}
          </div>
        </div>

        <div className="project-drawer-section">
          <div className="drawer-section-title">Description</div>
          <textarea
            className="form-textarea"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Project description…"
            rows={3}
            style={{ width: '100%', marginTop: '6px' }}
          />
        </div>

        <div className="project-drawer-section">
          <div className="drawer-section-title">Progress</div>
          <div className="project-drawer-stats">
            <div className="project-drawer-stat-row">
              <span className="project-drawer-stat-label">Tasks</span>
              <span className="project-drawer-stat-value">{done} / {total}</span>
            </div>
            <div className="project-drawer-stat-row">
              <span className="project-drawer-stat-label">Completion</span>
              <span className="project-drawer-stat-value">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', display: 'inline-block' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: pct === 100 ? '#2ECC71' : 'var(--accent-primary)', borderRadius: '2px' }} />
                  </span>
                  {pct}%
                </span>
              </span>
            </div>
            {importance && (
              <div className="project-drawer-stat-row">
                <span className="project-drawer-stat-label">Importance</span>
                <span className="project-drawer-stat-value" style={{ color: IMPORTANCE_COLORS[importance.cssClass] || 'var(--text-dimmed)', fontWeight: 600 }}>
                  {importance.label}
                </span>
              </div>
            )}
            {remainingMins > 0 && (
              <div className="project-drawer-stat-row">
                <span className="project-drawer-stat-label">Remaining</span>
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
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button type="button" className="btn btn-danger btn-delete" onClick={handleDelete} disabled={busy} style={{ marginRight: 'auto', fontSize: '12px' }}>
          {project.status === 'archived' ? 'Delete' : 'Archive'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} style={{ fontSize: '12px' }}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy} style={{ fontSize: '12px' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const { tasks, loading: tasksLoading, updateTask, deleteTask, refetch: refetchTasks } = useTasks();
  const { projects, loading: projectsLoading, updateProject, deleteProject, refetch: refetchProjects } = useProjects();
  usePeople(); // preload people for PersonPicker
  const [areas, setAreas] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => { fetchAreas().then(setAreas).catch(() => {}); }, []);

  const starredTasks    = useMemo(() => tasks.filter(t => t.is_starred),    [tasks]);
  const starredProjects = useMemo(() => projects.filter(p => p.is_starred), [projects]);
  const selectedTask    = selectedTaskId    ? tasks.find(t => t.id === selectedTaskId)       : null;
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  const isEmpty = !tasksLoading && !projectsLoading && starredTasks.length === 0 && starredProjects.length === 0;

  const handleUpdateTask = useCallback(async (id, data) => {
    await updateTask(id, data);
    refetchTasks();
  }, [updateTask, refetchTasks]);

  const handleDeleteTask = useCallback(async (id) => {
    await deleteTask(id);
    setSelectedTaskId(null);
  }, [deleteTask]);

  const handleUpdateProject = useCallback(async (id, data) => {
    await updateProject(id, data);
    refetchProjects();
  }, [updateProject, refetchProjects]);

  const handleDeleteProject = useCallback(async (id) => {
    await deleteProject(id);
    setSelectedProjectId(null);
  }, [deleteProject]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left: starred list */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Focus</h2>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Starred projects and tasks</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 8px' }}>
          {isEmpty && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-dimmed)' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>★</div>
              <p style={{ fontSize: '12px', margin: 0 }}>Star a project or task to pin it here.</p>
            </div>
          )}
          {(projectsLoading || starredProjects.length > 0) && (
            <div style={{ marginBottom: '20px' }}>
              <SectionLabel label="Projects" count={starredProjects.length} />
              {projectsLoading
                ? <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-dimmed)' }}>Loading…</div>
                : starredProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    isSelected={selectedProjectId === project.id}
                    onClick={() => {
                      setSelectedTaskId(null);
                      setSelectedProjectId(prev => prev === project.id ? null : project.id);
                    }}
                  />
                ))
              }
            </div>
          )}
          {(tasksLoading || starredTasks.length > 0) && (
            <div>
              <SectionLabel label="Tasks" count={starredTasks.length} />
              {tasksLoading
                ? <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-dimmed)' }}>Loading…</div>
                : starredTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => {
                      setSelectedProjectId(null);
                      setSelectedTaskId(prev => prev === task.id ? null : task.id);
                    }}
                  />
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Middle: inline detail panel — appears when something is selected */}
      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          projects={projects}
          areas={areas}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {selectedProject && (
        <ProjectPanel
          project={selectedProject}
          onSave={handleUpdateProject}
          onDelete={handleDeleteProject}
          onClose={() => setSelectedProjectId(null)}
        />
      )}

      {/* Right: Pomodoro — always visible */}
      <div style={{ width: '340px', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <PomodoroPanel
          timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          isMobileView={true}
        />
      </div>

    </div>
  );
}
