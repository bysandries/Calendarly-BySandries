import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { fetchAreas, fetchTasks, updateTask } from '../utils/api';
import { getStatusInfo, GTD_STATUSES, TASK_TABS, PRIORITY_COLORS, getNextPriority } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency, formatIsoDateShort } from '../lib/taskMath';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import ProjectPicker from '../components/ProjectPicker';

const PALM_PHASES = ['Plan', 'Act', 'Measure', 'Learn', 'Ignored'];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, updateProject, createProject } = useProjects();
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask, refetch } = useTasks({ project_id: id });
  const [areas, setAreas] = useState([]);
  const [activeTab, setActiveTab] = useState('actionable');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 0, estimated_minutes: '' });
  const [editingTitle, setEditingTitle] = useState(null);
  const [editingEct, setEditingEct] = useState(null);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const titleInputRef = useRef(null);

  // Find & Link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalTasks, setLinkModalTasks] = useState([]);
  const [linkModalLoading, setLinkModalLoading] = useState(false);
  const [linkModalStatusFilter, setLinkModalStatusFilter] = useState('');
  const [linkModalOnlyUnassigned, setLinkModalOnlyUnassigned] = useState(true);
  const [linkModalSearch, setLinkModalSearch] = useState('');
  const [linkModalSelectedIds, setLinkModalSelectedIds] = useState(new Set());

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    const filters = { project_id: id };
    refetch(filters);
  }, [id]);

  const project = projects.find(p => p.id === id);
  const area = areas.find(a => a.id === project?.area);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const minutes = parseInt(newTask.estimated_minutes, 10);
    await createTask({
      title: newTask.title,
      status: '01 - Inbox',
      project_id: id,
      priority: newTask.priority,
      estimated_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
    });
    setNewTask({ title: '', priority: 0, estimated_minutes: '' });
    setShowCreateForm(false);
  };

  const handleEctBlur = async (task, raw) => {
    setEditingEct(null);
    const minutes = parseInt(raw, 10);
    const next = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
    if (next !== (task.estimated_minutes || 0)) {
      await updateTask(task.id, { estimated_minutes: next });
    }
  };

  const handleDueDateChange = async (task, value) => {
    setEditingDueDate(null);
    const next = value || null;
    if (next !== (task.date_due || null)) {
      await updateTask(task.id, { date_due: next });
    }
  };

  const handlePriorityCycle = async (task) => {
    const next = getNextPriority(task.priority);
    await updateTask(task.id, { priority: next });
  };

  const handleTitleBlur = async (task, newTitle) => {
    setEditingTitle(null);
    if (newTitle && newTitle !== task.title) {
      await updateTask(task.id, { title: newTitle });
    }
  };

  const handleTitleKeyDown = (e, task) => {
    if (e.key === 'Enter') e.target.blur();
    else if (e.key === 'Escape') setEditingTitle(null);
  };

  const toggleSelect = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedTaskIds(prev => {
      const allSelected = sortedTasks.length > 0 && sortedTasks.every(t => prev.has(t.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(sortedTasks.map(t => t.id));
    });
  };

  const clearSelection = () => setSelectedTaskIds(new Set());

  const handleBulkStatusChange = async (newStatus) => {
    const ids = Array.from(selectedTaskIds);
    for (const id of ids) {
      await updateTask(id, { status: newStatus });
    }
    clearSelection();
  };

  const openLinkModal = async () => {
    setShowLinkModal(true);
    setLinkModalLoading(true);
    setLinkModalSelectedIds(new Set());
    try {
      const data = await fetchTasks({
        unassigned: linkModalOnlyUnassigned ? 'true' : undefined,
        status: linkModalStatusFilter || undefined,
        q: linkModalSearch || undefined,
      });
      setLinkModalTasks(data);
    } catch {
      setLinkModalTasks([]);
    } finally {
      setLinkModalLoading(false);
    }
  };

  const closeLinkModal = () => {
    setShowLinkModal(false);
    setLinkModalTasks([]);
    setLinkModalSelectedIds(new Set());
    setLinkModalSearch('');
    setLinkModalStatusFilter('');
    setLinkModalOnlyUnassigned(true);
  };

  const refreshLinkModal = async () => {
    setLinkModalLoading(true);
    try {
      const data = await fetchTasks({
        unassigned: linkModalOnlyUnassigned ? 'true' : undefined,
        status: linkModalStatusFilter || undefined,
        q: linkModalSearch || undefined,
      });
      setLinkModalTasks(data);
    } catch {
      setLinkModalTasks([]);
    } finally {
      setLinkModalLoading(false);
    }
  };

  const toggleLinkModalSelect = (taskId) => {
    setLinkModalSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleLinkModalSelectAll = () => {
    setLinkModalSelectedIds(prev => {
      const allSelected = linkModalTasks.length > 0 && linkModalTasks.every(t => prev.has(t.id));
      if (allSelected) return new Set();
      return new Set(linkModalTasks.map(t => t.id));
    });
  };

  const handleBulkLinkToProject = async () => {
    const ids = Array.from(linkModalSelectedIds);
    for (const taskId of ids) {
      await updateTask(taskId, { project_id: id });
    }
    setLinkModalSelectedIds(new Set());
    refreshLinkModal();
    // Also refresh the project's task list
    refetch({ project_id: id });
  };

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().toDateString());
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const visibleTasks = tasks.filter(t => t.status !== '00 - Not Actionable');

  const activeTabDef = TASK_TABS.find(t => t.key === activeTab);
  const filteredTasks = activeTabDef
    ? visibleTasks.filter(t => activeTabDef.statuses.includes(t.status))
    : visibleTasks;

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let cmp = 0;
    switch (sortConfig.key) {
      case 'status': {
        const idxA = GTD_STATUSES.indexOf(a.status);
        const idxB = GTD_STATUSES.indexOf(b.status);
        cmp = idxA - idxB;
        break;
      }
      case 'priority':
        cmp = a.priority - b.priority;
        break;
      case 'title':
        cmp = (a.title || '').localeCompare(b.title || '');
        break;
      case 'date_due': {
        if (!a.date_due && !b.date_due) cmp = 0;
        else if (!a.date_due) cmp = 1;
        else if (!b.date_due) cmp = -1;
        else cmp = new Date(a.date_due) - new Date(b.date_due);
        break;
      }
      case 'ect':
        cmp = (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
        break;
      case 'days_left': {
        const dlA = calcDaysLeft(a.date_due);
        const dlB = calcDaysLeft(b.date_due);
        if (dlA === null && dlB === null) cmp = 0;
        else if (dlA === null) cmp = 1;
        else if (dlB === null) cmp = -1;
        else cmp = dlA - dlB;
        break;
      }
      case 'urgency': {
        const uA = calcUrgency(calcDaysLeft(a.date_due), a.estimated_minutes);
        const uB = calcUrgency(calcDaysLeft(b.date_due), b.estimated_minutes);
        const sA = uA.slack === null ? Number.POSITIVE_INFINITY : uA.slack;
        const sB = uB.slack === null ? Number.POSITIVE_INFINITY : uB.slack;
        cmp = sA - sB;
        break;
      }
      default:
        cmp = 0;
    }
    return sortConfig.direction === 'asc' ? cmp : -cmp;
  });

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  if (projectsLoading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton" style={{ width: '200px', height: '28px' }} />
        </div>
        <div className="glass-panel">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-ghost" onClick={() => navigate('/projects')} style={{ marginBottom: '12px' }}>
            ← Projects
          </button>
          <h2>Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/projects')}
        style={{ marginBottom: '16px', fontSize: '0.8rem' }}
      >
        ← All Projects
      </button>

      {/* Project Header */}
      <div className="glass-panel" style={{ marginBottom: '20px', padding: '20px 24px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          {area && (
            <div style={{ width: '4px', minHeight: '40px', borderRadius: '2px', background: area.color_hex, flexShrink: 0, marginTop: '4px' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ marginBottom: '4px', fontSize: '1.3rem' }}>{project.title}</h2>
            {project.description && (
              <p className="page-description" style={{ marginBottom: 0 }}>{project.description}</p>
            )}
          </div>
          <ProjectStatusBadge
            status={project.status}
            onChange={(newStatus) => updateProject(project.id, { status: newStatus })}
          />
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          {/* Area */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Area</div>
            <select
              className="form-select"
              style={{ padding: '3px 10px', height: 'auto', fontSize: '0.82rem', width: '100%' }}
              value={project.area}
              onChange={(e) => updateProject(project.id, { area: e.target.value })}
            >
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Pillar */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Pillar</div>
            <select
              className="form-select"
              style={{ padding: '3px 10px', height: 'auto', fontSize: '0.82rem', width: '100%' }}
              value={project.pillar}
              onChange={(e) => updateProject(project.id, { pillar: e.target.value })}
            >
              {['Kindness', 'Authenticity', 'Resilience', 'Innovation'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Person in charge */}
          {project.person_in_charge && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Person</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{project.person_in_charge}</div>
            </div>
          )}

          {/* Due date */}
          {project.due_date && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Due</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatIsoDateShort(project.due_date)}</div>
            </div>
          )}

          {/* Start date */}
          {project.start_date && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Start</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatIsoDateShort(project.start_date)}</div>
            </div>
          )}

          {/* End date */}
          {project.end_date && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>End</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatIsoDateShort(project.end_date)}</div>
            </div>
          )}

          {/* Time Invested */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Time Invested</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: (project.pomodoro_minutes ?? 0) > 0 ? 'var(--accent-primary)' : 'var(--text-dimmed)' }}>
              {formatDuration(project.pomodoro_minutes ?? 0)}
            </div>
          </div>

          {/* Task progress */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Progress</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {project.complete_tasks ?? 0} / {project.total_tasks ?? 0} tasks
            </div>
          </div>
        </div>

        {/* Goals aligned */}
        {project.goals_aligned && project.goals_aligned.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Goals Aligned</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {project.goals_aligned.map((g, i) => (
                <span key={i} style={{
                  fontSize: '0.75rem',
                  padding: '2px 10px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PALM Phase selector */}
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>PALM Phase</div>
          <div className="palm-phases" style={{ margin: 0 }}>
            {PALM_PHASES.map(phase => (
              <span
                key={phase}
                className={`palm-phase ${phase.toLowerCase()} ${project.phase === phase ? 'active' : ''}`}
                onClick={() => updateProject(project.id, { phase })}
                style={{ cursor: 'pointer' }}
              >
                {phase}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Tasks — {visibleTasks.length}
        </h3>
        <button className="btn btn-ghost" onClick={openLinkModal} style={{ fontSize: '0.8rem' }}>
          Find tasks to link
        </button>
      </div>

      <div className="task-tabs" style={{ marginBottom: '16px' }}>
        {TASK_TABS.map(tab => {
          const count = visibleTasks.filter(t => tab.statuses.includes(t.status)).length;
          return (
            <button
              key={tab.key}
              className={`task-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="tab-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Inline create form */}
      {showCreateForm && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '200px', marginBottom: 0 }}>
              <label className="form-label">Task Title</label>
              <input
                className="form-input"
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
              <label className="form-label">ECT (min)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="5"
                placeholder="0"
                value={newTask.estimated_minutes}
                onChange={(e) => setNewTask(prev => ({ ...prev, estimated_minutes: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary">Add Task</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="glass-panel bulk-action-bar" style={{ padding: '12px 20px', marginBottom: '16px' }}>
          <span className="bulk-count">{selectedTaskIds.size} selected</span>
          <select
            className="form-select"
            defaultValue=""
            onChange={(e) => handleBulkStatusChange(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="" disabled>Change status to...</option>
            {GTD_STATUSES.map(s => (
              <option key={s} value={s}>{getStatusInfo(s).label}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => handleBulkStatusChange('07 - Done')}>
            Mark as Done
          </button>
          <button className="btn btn-ghost" onClick={clearSelection}>Clear</button>
        </div>
      )}

      {/* Tasks table */}
      {tasksLoading ? (
        <div className="glass-panel">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>No {activeTabDef?.label.toLowerCase()} tasks</h3>
            <p>Add a task or switch tabs to see other statuses.</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={sortedTasks.length > 0 && sortedTasks.every(t => selectedTaskIds.has(t.id))}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th className="sortable-header" style={{ width: '100px' }} onClick={() => handleSort('urgency')}>Urgency <SortIndicator columnKey="urgency" /></th>
                <th className="sortable-header" style={{ width: '130px' }} onClick={() => handleSort('status')}>Status <SortIndicator columnKey="status" /></th>
                <th className="sortable-header" style={{ width: '60px' }} onClick={() => handleSort('priority')}>Priority <SortIndicator columnKey="priority" /></th>
                <th className="sortable-header" onClick={() => handleSort('title')}>Title <SortIndicator columnKey="title" /></th>
                <th className="sortable-header" style={{ width: '90px' }} onClick={() => handleSort('ect')}>ECT <SortIndicator columnKey="ect" /></th>
                <th className="sortable-header" style={{ width: '130px' }} onClick={() => handleSort('date_due')}>Due Date <SortIndicator columnKey="date_due" /></th>
                <th className="sortable-header" style={{ width: '90px' }} onClick={() => handleSort('days_left')}>Days Left <SortIndicator columnKey="days_left" /></th>
                <th style={{ width: '40px' }}></th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map(task => {
                const statusInfo = getStatusInfo(task.status);
                const daysLeft = calcDaysLeft(task.date_due);
                const urgency = calcUrgency(daysLeft, task.estimated_minutes);
                const urgencyTitle = [
                  `Received: ${formatIsoDateShort(task.received_date)}`,
                  `Finished: ${formatIsoDateShort(task.finished_date)}`,
                  urgency.daysNeeded != null ? `Days needed: ${urgency.daysNeeded}` : null,
                  urgency.slack != null ? `Slack: ${urgency.slack}d` : null,
                ].filter(Boolean).join('\n');
                return (
                  <tr key={task.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="task-checkbox"
                        checked={selectedTaskIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                      />
                    </td>
                    <td>
                      <span className={`urgency-badge ${urgency.cssClass}`} title={urgencyTitle}>
                        {urgency.label}
                      </span>
                    </td>
                    <td>
                      <select
                        className={`status-select ${statusInfo.cssClass}`}
                        value={task.status || '01 - Inbox'}
                        onChange={(e) => updateTask(task.id, { status: e.target.value })}
                        title="Change status"
                      >
                        {GTD_STATUSES.map(s => (
                          <option key={s} value={s}>{getStatusInfo(s).label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div
                        className="priority-dots"
                        onClick={() => handlePriorityCycle(task)}
                        title={`Priority: ${task.priority}/3 — Click to cycle`}
                      >
                        {[1, 2, 3].map(level => (
                          <div
                            key={level}
                            className={`priority-dot ${level <= task.priority ? 'filled' : ''}`}
                            style={level <= task.priority ? { background: PRIORITY_COLORS[task.priority] } : {}}
                          />
                        ))}
                      </div>
                    </td>
                    <td>
                      {editingTitle === task.id ? (
                        <input
                          ref={titleInputRef}
                          className="inline-edit"
                          defaultValue={task.title}
                          onBlur={(e) => handleTitleBlur(task, e.target.value)}
                          onKeyDown={(e) => handleTitleKeyDown(e, task)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cell-truncate"
                          style={{ cursor: 'text', display: 'block' }}
                          onClick={() => setEditingTitle(task.id)}
                          title="Click to edit"
                        >
                          {task.title}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingEct === task.id ? (
                        <input
                          type="number"
                          min="0"
                          step="5"
                          className="inline-edit-compact"
                          defaultValue={task.estimated_minutes || ''}
                          autoFocus
                          onBlur={(e) => handleEctBlur(task, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            else if (e.key === 'Escape') setEditingEct(null);
                          }}
                        />
                      ) : (
                        <span
                          className="ect-cell"
                          onClick={() => setEditingEct(task.id)}
                          title="Click to edit estimated completion time (minutes)"
                        >
                          {formatDuration(task.estimated_minutes)}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingDueDate === task.id ? (
                        <input
                          type="date"
                          className="inline-edit-compact"
                          defaultValue={task.date_due || ''}
                          autoFocus
                          onBlur={(e) => handleDueDateChange(task, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            else if (e.key === 'Escape') setEditingDueDate(null);
                          }}
                        />
                      ) : (
                        <span
                          className={isOverdue(task.date_due) ? 'overdue' : ''}
                          onClick={() => setEditingDueDate(task.id)}
                          style={{ cursor: 'pointer' }}
                          title="Click to edit due date"
                        >
                          {formatDate(task.date_due)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`days-left-cell ${daysLeft !== null && daysLeft < 0 ? 'overdue' : ''}`}>
                        {formatDaysLeft(daysLeft)}
                      </span>
                    </td>
                    <td>
                      {task.notes && <span className="notes-indicator" title={task.notes}>📝</span>}
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          if (confirm('Delete this task?')) deleteTask(task.id);
                        }}
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Find & Link Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={closeLinkModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link tasks to {project?.title}</h3>
              <button className="btn-icon" onClick={closeLinkModal} title="Close">✕</button>
            </div>

            <div className="modal-filters" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <select
                className="form-select"
                value={linkModalStatusFilter}
                onChange={(e) => { setLinkModalStatusFilter(e.target.value); }}
                style={{ minWidth: '160px' }}
              >
                <option value="">All Statuses</option>
                {GTD_STATUSES.map(s => (
                  <option key={s} value={s}>{getStatusInfo(s).label}</option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={linkModalOnlyUnassigned}
                  onChange={(e) => setLinkModalOnlyUnassigned(e.target.checked)}
                />
                Only unassigned
              </label>
              <input
                className="form-input"
                placeholder="Search tasks..."
                value={linkModalSearch}
                onChange={(e) => setLinkModalSearch(e.target.value)}
                style={{ flex: '1', minWidth: '160px' }}
              />
              <button className="btn btn-ghost" onClick={refreshLinkModal}>Search</button>
            </div>

            {linkModalLoading ? (
              <div className="glass-panel">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
              </div>
            ) : linkModalTasks.length === 0 ? (
              <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-dimmed)' }}>No tasks match your filters.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          className="task-checkbox"
                          checked={linkModalTasks.length > 0 && linkModalTasks.every(t => linkModalSelectedIds.has(t.id))}
                          onChange={toggleLinkModalSelectAll}
                        />
                      </th>
                      <th style={{ width: '130px' }}>Status</th>
                      <th>Title</th>
                      <th style={{ width: '180px' }}>Project</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkModalTasks.map(task => {
                      const statusInfo = getStatusInfo(task.status);
                      return (
                        <tr key={task.id}>
                          <td>
                            <input
                              type="checkbox"
                              className="task-checkbox"
                              checked={linkModalSelectedIds.has(task.id)}
                              onChange={() => toggleLinkModalSelect(task.id)}
                            />
                          </td>
                          <td>
                            <span className={`status-badge ${statusInfo.cssClass}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td>{task.title}</td>
                          <td>
                            {task.project_id ? (
                              <span className="cell-project-badge">
                                {projects.find(p => p.id === task.project_id)?.title || '—'}
                              </span>
                            ) : (
                              <ProjectPicker
                                projects={projects}
                                onSelect={(projectId) => updateTask(task.id, { project_id: projectId })}
                                onCreate={async (title) => {
                                  const p = await createProject({
                                    title,
                                    status: 'active',
                                    area: 'general',
                                    pillar: 'Innovation',
                                    phase: 'Plan',
                                    methodology: 'PALM',
                                  });
                                  await updateTask(task.id, { project_id: p.id });
                                }}
                              />
                            )}
                          </td>
                          <td>
                            <button
                              className="btn-icon"
                              onClick={() => {
                                if (confirm('Delete this task?')) deleteTask(task.id);
                              }}
                              title="Delete task"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {linkModalSelectedIds.size > 0 && (
              <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleBulkLinkToProject}
                >
                  Link {linkModalSelectedIds.size} selected to {project?.title}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setShowCreateForm(!showCreateForm)} title="Add task to project">
        +
      </button>
    </div>
  );
}
