import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas } from '../utils/api';
import ProjectPicker from '../components/ProjectPicker';
import { getStatusInfo, GTD_STATUSES, TASK_TABS, PRIORITY_COLORS, getNextPriority } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency, formatIsoDateShort } from '../lib/taskMath';

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, refetch } = useTasks();
  const { projects, createProject } = useProjects();
  const [areas, setAreas] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [activeTab, setActiveTab] = useState('actionable');
  const [editingTitle, setEditingTitle] = useState(null);
  const [editingEct, setEditingEct] = useState(null);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', project_id: '', priority: 0, estimated_minutes: '' });
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const titleInputRef = useRef(null);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    const filters = {};
    if (projectFilter) filters.project_id = projectFilter;
    refetch(filters);
  }, [projectFilter]);

  const getProjectTitle = (projectId) => {
    const p = projects.find(pr => pr.id === projectId);
    return p ? p.title : null;
  };

  const getProjectArea = (projectId) => {
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return null;
    const area = areas.find(a => a.id === p.area);
    return area || null;
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
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setEditingTitle(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const minutes = parseInt(newTask.estimated_minutes, 10);
    await createTask({
      title: newTask.title,
      status: '01 - Inbox',
      project_id: newTask.project_id || null,
      priority: newTask.priority,
      estimated_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
    });
    setNewTask({ title: '', project_id: '', priority: 0, estimated_minutes: '' });
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

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().toDateString());
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      case 'project': {
        const titleA = getProjectTitle(a.project_id) || '';
        const titleB = getProjectTitle(b.project_id) || '';
        cmp = titleA.localeCompare(titleB);
        break;
      }
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
        // Sort by slack ascending (most critical first when asc)
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

  return (
    <div>
      <div className="page-header">
        <h2>Tasks</h2>
        <p className="page-description">Manage your GTD workflow — click status badges and priority dots to edit inline</p>
      </div>

      {/* Tabs */}
      <div className="filter-bar">
        <div className="task-tabs">
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

        <select
          className="filter-select"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Create Form */}
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
            <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={newTask.project_id}
                onChange={(e) => setNewTask(prev => ({ ...prev, project_id: e.target.value }))}
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
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

      {/* Table */}
      {loading ? (
        <div className="glass-panel">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-danger)' }}>
          Error loading tasks: {error}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>No {activeTabDef?.label.toLowerCase()} tasks</h3>
            <p>Create a new task or switch tabs to see other statuses.</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel data-table-wrapper">
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
                <th className="sortable-header" style={{ width: '180px' }} onClick={() => handleSort('project')}>Project <SortIndicator columnKey="project" /></th>
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
                const projectTitle = getProjectTitle(task.project_id);
                const projectArea = getProjectArea(task.project_id);
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
                          <option key={s} value={s}>
                            {getStatusInfo(s).label}
                          </option>
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
                      <Link
                        to={`/tasks/${task.id}`}
                        className="cell-truncate project-title-link"
                        style={{ display: 'block', fontWeight: 500 }}
                        title="View details"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td>
                      {projectTitle ? (
                        <span className="cell-project-badge">
                          {projectArea && (
                            <span
                              className="color-swatch"
                              style={{ background: projectArea.color_hex }}
                            />
                          )}
                          {projectTitle}
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
                      {task.notes && (
                        <span className="notes-indicator" title={task.notes}>📝</span>
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

      {!loading && !error && sortedTasks.length > 0 && (
        <div className="tasks-mobile-list">
          {sortedTasks.map(task => (
            <Link key={task.id} to={`/tasks/${task.id}`} className="task-mobile-card">
              <div className="task-mobile-info">
                <span className="task-mobile-title">{task.title}</span>
                <span className="task-mobile-date">
                  {task.date_due ? `Due: ${formatDate(task.date_due)}` : 'No due date'}
                </span>
              </div>
              <div className="task-mobile-arrow">›</div>
            </Link>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        className="fab"
        onClick={() => setShowCreateForm(!showCreateForm)}
        title="Add new task"
      >
        +
      </button>
    </div>
  );
}
