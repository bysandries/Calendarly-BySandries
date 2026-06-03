import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas } from '../utils/api/areas';
import PomodoroPanel from '../components/PomodoroPanel';
import PersonPicker from '../components/PersonPicker';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import { GTD_STATUSES, getStatusInfo, PRIORITY_COLORS, TASK_TABS } from '../utils/statusMap';
import { calcDaysLeft, formatDaysLeft, calcProgression, calcImportance, formatDuration } from '../lib/taskMath';
import { fetchTasks as apiFetchTasks, createTask as apiCreateTask } from '../utils/api/tasks';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px 8px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dimmed)' }}>
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
        padding: '9px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: priorityColor, fontSize: '10px', flexShrink: 0 }}>●</span>
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {project && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </span>
      )}
      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: status.color ?? 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {status.label}
      </span>
      {task.date_due && (
        <span style={{ fontSize: '12px', color: overdue ? 'var(--danger, #e74c3c)' : 'var(--text-dimmed)', flexShrink: 0 }}>
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
        padding: '9px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {project.phase && (
        <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: 'rgba(52,152,219,0.1)', color: 'var(--accent-primary)', flexShrink: 0 }}>
          {project.phase}
        </span>
      )}
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.title}
      </span>
      {total > 0 && (
        <div style={{ width: '52px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#2ecc71' : 'var(--accent-primary)', borderRadius: '2px' }} />
        </div>
      )}
      <span style={{ fontSize: '12px', color: 'var(--text-dimmed)', flexShrink: 0, width: '30px', textAlign: 'right' }}>
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
            style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}
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

// ── Compact task row inside the project panel ────────────────────────────────

function PanelTaskRow({ task, onUpdate, onDelete, onStartTask }) {
  const status = getStatusInfo(task.status);
  const daysLeft = calcDaysLeft(task.date_due);
  const overdue = task.date_due && daysLeft < 0;
  const isDone = task.status === '07 - Done';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? 'var(--text-dimmed)';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 8px', borderRadius: '5px', opacity: isDone ? 0.55 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <button
        type="button"
        onClick={() => onUpdate(task.id, { status: isDone ? '02 - Next Step' : '07 - Done' })}
        style={{
          width: '17px', height: '17px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          border: `1.5px solid ${isDone ? '#2ECC71' : 'rgba(255,255,255,0.22)'}`,
          background: isDone ? '#2ECC71' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '9px',
        }}
      >
        {isDone ? '✓' : ''}
      </button>
      <span style={{ color: priorityColor, fontSize: '9px', flexShrink: 0 }}>●</span>
      <span style={{
        flex: 1, fontSize: '13px', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {task.title}
      </span>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <select
          value={task.status}
          onChange={e => onUpdate(task.id, { status: e.target.value })}
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: '11px', paddingTop: '2px', paddingBottom: '2px',
            paddingLeft: '6px', paddingRight: '16px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${status.color ?? 'rgba(255,255,255,0.15)'}`,
            color: status.color ?? 'var(--text-muted)',
            cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none', outline: 'none',
          }}
        >
          {GTD_STATUSES.map(s => (
            <option key={s} value={s}>{getStatusInfo(s).label}</option>
          ))}
        </select>
        <span style={{
          position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
          color: status.color ?? 'var(--text-muted)', fontSize: '8px', pointerEvents: 'none',
          lineHeight: 1,
        }}>▾</span>
      </div>
      {task.date_due && (
        <span style={{ fontSize: '11px', color: overdue ? 'var(--danger, #e74c3c)' : 'var(--text-dimmed)', flexShrink: 0 }}>
          {formatDaysLeft(daysLeft)}
        </span>
      )}
      {onStartTask && (
        <button
          type="button"
          onClick={() => onStartTask(task)}
          title="Focus on this task"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1, fontSize: '11px',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => onUpdate(task.id, { is_starred: task.is_starred === 1 ? 0 : 1 })}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0, color: task.is_starred === 1 ? '#F1C40F' : 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}
      >
        {task.is_starred === 1 ? '★' : '☆'}
      </button>
    </div>
  );
}

// ── Inline project detail panel ──────────────────────────────────────────────

const PANEL_TASK_TABS = [
  { key: 'actionable', label: 'Actionable' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

function ProjectPanel({ project, projectTasks, projectTasksLoading, areas, onSave, onDelete, onClose, onUpdateTask, onCreateTask, onStartTask }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('actionable');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingGoals, setEditingGoals] = useState(false);
  const [panelWidth, setPanelWidth] = useState(460);
  const resizeState = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeState.current) return;
      const delta = resizeState.current.startX - e.clientX;
      setPanelWidth(Math.min(800, Math.max(300, resizeState.current.startWidth + delta)));
    };
    const onUp = () => { resizeState.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  useEffect(() => {
    setForm({
      title:         project.title || '',
      status:        project.status || 'active',
      phase:         project.phase || 'Plan',
      pillar:        project.pillar || 'Innovation',
      area:          project.area || 'general',
      person_id:     project.person_id || '',
      due_date:      project.due_date || '',
      start_date:    project.start_date || '',
      end_date:      project.end_date || '',
      description:   project.description || '',
      goals_aligned: project.goals_aligned || [],
    });
    setEditingGoals(false);
    setShowCreateForm(false);
    setActiveTab('actionable');
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onCreateTask({ title: newTaskTitle.trim(), project_id: project.id, status: '01 - Inbox', priority: 0 });
    setNewTaskTitle('');
    setShowCreateForm(false);
  };

  const total = project.total_tasks ?? 0;
  const done  = project.complete_tasks ?? 0;
  const pct   = calcProgression(done, total);
  const pomodoroMins = project.pomodoro_minutes ?? 0;
  const remainingMins = project.remaining_estimated_minutes ?? 0;
  const importance = calcImportance(total);
  const areaObj = areas.find(a => a.id === form.area);

  const visibleTasks = projectTasks.filter(t => t.status !== '00 - Not Actionable');
  const actionableStatuses = TASK_TABS.find(t => t.key === 'actionable')?.statuses ?? [];
  const doneStatuses = TASK_TABS.find(t => t.key === 'done')?.statuses ?? [];
  const filteredTasks = activeTab === 'all'
    ? visibleTasks
    : activeTab === 'actionable'
    ? visibleTasks.filter(t => actionableStatuses.includes(t.status))
    : visibleTasks.filter(t => doneStatuses.includes(t.status));

  return (
    <div style={{ width: panelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', position: 'relative' }}>

      {/* Resize handle on left border */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          resizeState.current = { startX: e.clientX, startWidth: panelWidth };
          document.body.style.cursor = 'col-resize';
        }}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px',
          cursor: 'col-resize', zIndex: 20,
          background: 'transparent',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,152,219,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {areaObj && (
            <div style={{ width: '3px', minHeight: '38px', borderRadius: '2px', background: areaObj.color_hex, flexShrink: 0, marginTop: '3px' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="inline-edit"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Project title…"
              style={{ fontSize: '16px', fontWeight: 700, width: '100%', marginBottom: '6px' }}
            />
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Add a description…"
              rows={2}
              style={{ width: '100%', fontSize: '13px', resize: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '0 2px', lineHeight: 1 }}
            >
              ×
            </button>
            <ProjectStatusBadge status={form.status} onChange={s => set('status', s)} />
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Meta grid */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>Area</div>
              <select className="form-select" style={{ padding: '3px 6px', height: 'auto', fontSize: '0.75rem', width: '100%' }} value={form.area} onChange={e => set('area', e.target.value)}>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>Pillar</div>
              <select className="form-select" style={{ padding: '3px 6px', height: 'auto', fontSize: '0.75rem', width: '100%' }} value={form.pillar} onChange={e => set('pillar', e.target.value)}>
                {PILLARS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>Person</div>
              <PersonPicker value={form.person_id} onSelect={id => set('person_id', id)} placeholder="Unassigned" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>Due Date</div>
              <input type="date" className="form-input" style={{ padding: '3px 6px', height: 'auto', fontSize: '0.75rem', width: '100%' }} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>Start Date</div>
              <input type="date" className="form-input" style={{ padding: '3px 6px', height: 'auto', fontSize: '0.75rem', width: '100%' }} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>End Date</div>
              <input type="date" className="form-input" style={{ padding: '3px 6px', height: 'auto', fontSize: '0.75rem', width: '100%' }} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Goals aligned */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>Goals Aligned</div>
          {editingGoals ? (
            <input
              className="form-input"
              defaultValue={Array.isArray(form.goals_aligned) ? form.goals_aligned.join(', ') : ''}
              autoFocus
              onBlur={e => {
                setEditingGoals(false);
                set('goals_aligned', e.target.value.split(',').map(s => s.trim()).filter(Boolean));
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.target.blur();
                else if (e.key === 'Escape') setEditingGoals(false);
              }}
              placeholder="Goals separated by commas…"
              style={{ width: '100%', fontSize: '0.78rem' }}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', cursor: 'pointer', minHeight: '20px' }} onClick={() => setEditingGoals(true)}>
              {Array.isArray(form.goals_aligned) && form.goals_aligned.length > 0 ? (
                form.goals_aligned.map((g, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                    {g}
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--text-dimmed)', fontSize: '0.75rem' }}>Click to add goals…</span>
              )}
            </div>
          )}
        </div>

        {/* PALM Phase */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>PALM Phase</div>
          <div className="palm-phases" style={{ margin: 0 }}>
            {PALM_PHASES.map(phase => (
              <span
                key={phase}
                className={`palm-phase ${phase.toLowerCase()} ${form.phase === phase ? 'active' : ''}`}
                onClick={() => set('phase', phase)}
                style={{ cursor: 'pointer' }}
              >
                {phase}
              </span>
            ))}
          </div>
        </div>

        {/* Progress stats */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>{done} / {total} tasks</span>
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#2ECC71' : 'var(--accent-primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>{pct}%</span>
            {importance && (
              <span style={{ fontSize: '10px', color: IMPORTANCE_COLORS[importance.cssClass] || 'var(--text-dimmed)', fontWeight: 600, flexShrink: 0 }}>
                {importance.label}
              </span>
            )}
            {pomodoroMins > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--accent-primary)', flexShrink: 0 }}>⏱ {formatDuration(pomodoroMins)}</span>
            )}
            {remainingMins > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-dimmed)', flexShrink: 0 }}>{formatDuration(remainingMins)} left</span>
            )}
          </div>
        </div>

        {/* Tasks section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '180px' }}>
          {/* Task tabs + add button */}
          <div style={{ padding: '8px 16px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ flex: 1, display: 'flex' }}>
              {PANEL_TASK_TABS.map(tab => {
                const count = tab.key === 'all'
                  ? visibleTasks.length
                  : tab.key === 'actionable'
                  ? visibleTasks.filter(t => actionableStatuses.includes(t.status)).length
                  : visibleTasks.filter(t => doneStatuses.includes(t.status)).length;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`task-tab ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    {tab.label}
                    <span className="tab-badge">{count}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(v => !v)}
              title="Add task"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '20px', padding: '0 2px', lineHeight: 1, marginBottom: '3px' }}
            >
              +
            </button>
          </div>

          {/* Quick-create form */}
          {showCreateForm && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '6px' }}>
                <input
                  className="form-input"
                  placeholder="New task title…"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  autoFocus
                  style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>Add</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateForm(false)} style={{ fontSize: '11px', padding: '4px 8px' }}>✕</button>
              </form>
            </div>
          )}

          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
            {projectTasksLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dimmed)', fontSize: '12px' }}>Loading tasks…</div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dimmed)', fontSize: '12px' }}>No tasks in this tab.</div>
            ) : (
              filteredTasks.map(task => (
                <PanelTaskRow
                  key={task.id}
                  task={task}
                  onUpdate={onUpdateTask}
                  onDelete={() => {}}
                  onStartTask={onStartTask}
                />
              ))
            )}
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
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectTasksLoading, setProjectTasksLoading] = useState(false);
  const pomodoroRef = useRef(null);

  useEffect(() => { fetchAreas().then(setAreas).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedProjectId) { setProjectTasks([]); return; }
    setProjectTasksLoading(true);
    apiFetchTasks({ project_id: selectedProjectId })
      .then(setProjectTasks)
      .catch(() => setProjectTasks([]))
      .finally(() => setProjectTasksLoading(false));
  }, [selectedProjectId]);

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

  const handleCreateProjectTask = useCallback(async (data) => {
    const task = await apiCreateTask(data);
    setProjectTasks(prev => [task, ...prev]);
    refetchTasks();
  }, [refetchTasks]);

  const handleUpdateProjectTask = useCallback(async (id, data) => {
    const updated = await updateTask(id, data);
    setProjectTasks(prev => prev.map(t => t.id === id ? { ...t, ...data, ...(updated || {}) } : t));
    refetchTasks();
  }, [updateTask, refetchTasks]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left: starred list */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
        <div className="page-header" style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, marginBottom: 0 }}>
          <h2>Focus</h2>
          <p className="page-description">Starred projects and tasks</p>
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
          projectTasks={projectTasks}
          projectTasksLoading={projectTasksLoading}
          areas={areas}
          onSave={handleUpdateProject}
          onDelete={handleDeleteProject}
          onClose={() => setSelectedProjectId(null)}
          onUpdateTask={handleUpdateProjectTask}
          onCreateTask={handleCreateProjectTask}
          onStartTask={task => pomodoroRef.current?.selectTask(task)}
        />
      )}

      {/* Right: Pomodoro — always visible */}
      <div style={{ width: '340px', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <PomodoroPanel
          ref={pomodoroRef}
          timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          isMobileView={true}
        />
      </div>

    </div>
  );
}
