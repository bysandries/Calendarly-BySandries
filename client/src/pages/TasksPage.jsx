import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas } from '../utils/api';
import ProjectPicker from '../components/ProjectPicker';
import TaskCard from '../components/TaskCard';
import { getStatusInfo, GTD_STATUSES, TASK_TABS, PRIORITY_COLORS, getNextPriority } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency, formatIsoDateShort } from '../lib/taskMath';

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, refetch } = useTasks();
  const { projects, createProject } = useProjects();
  const [areas, setAreas] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [activeTab, setActiveTab] = useState('actionable');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', project_id: '', priority: 0, estimated_minutes: '' });
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState({
    urgency: true,
    status: true,
    priority: true,
    title: true,
    project: true,
    ect: true,
    date_due: true,
    days_left: true,
    notes: false,
    actions: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    'urgency', 'status', 'priority', 'title', 'project', 'ect', 'date_due', 'days_left', 'notes', 'actions'
  ]);
  const [columnWidths, setColumnWidths] = useState({
    urgency: 100,
    status: 130,
    priority: 80,
    title: 300,
    project: 180,
    ect: 90,
    date_due: 130,
    days_left: 90,
    notes: 40,
    actions: 60,
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const resizingColumn = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingColumn.current) return;
      const { key, startX, startWidth } = resizingColumn.current;
      const deltaX = e.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [key]: Math.max(50, startWidth + deltaX)
      }));
    };

    const handleMouseUp = () => {
      resizingColumn.current = null;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e, key) => {
    e.preventDefault();
    resizingColumn.current = {
      key,
      startX: e.clientX,
      startWidth: columnWidths[key]
    };
    document.body.style.cursor = 'col-resize';
  };

  const moveColumn = (index, direction) => {
    const newOrder = [...columnOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setColumnOrder(newOrder);
  };
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

  const visibleTasks = tasks.filter(t => t.status !== '00 - Not Actionable');

  const activeTabDef = TASK_TABS.find(t => t.key === activeTab);
  
  const STATUS_COLORS = {
    actionable: '#3498DB', // Blue
    planned: '#9B59B6',    // Purple
    someday: '#E67E22',    // Orange
    done: '#2ECC71'        // Green
  };

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
        {/* Desktop Tabs */}
        <div className="task-tabs desktop-only">
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

        {/* Mobile Selection Menu */}
        <div className="task-status-mobile-menu mobile-only">
          <label htmlFor="mobile-status-select" className="form-label" style={{ marginBottom: '8px', display: 'block' }}>View Status</label>
          <select
            id="mobile-status-select"
            className="form-select"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {TASK_TABS.map(tab => {
              const count = visibleTasks.filter(t => tab.statuses.includes(t.status)).length;
              return (
                <option key={tab.key} value={tab.key}>
                  {tab.label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <select
          className="filter-select desktop-only"
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
          <div className="mobile-hide" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button
                className="btn-icon"
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                title="Toggle Columns"
              >
                ⚙️
              </button>
              {showColumnPicker && (
                <div className="glass-panel glass-panel-strong" style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  zIndex: 200,
                  padding: '16px',
                  minWidth: '240px',
                  boxShadow: 'var(--shadow-xl)',
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Manage Columns</div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {columnOrder.map((col, index) => (
                      <div key={col} className="column-picker-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col]}
                          onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.85rem', color: visibleColumns[col] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ')}
                        </span>
                        <div className="column-reorder-btns">
                          <button
                            className="reorder-btn"
                            onClick={() => moveColumn(index, -1)}
                            disabled={index === 0}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            className="reorder-btn"
                            onClick={() => moveColumn(index, 1)}
                            disabled={index === columnOrder.length - 1}
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="mobile-hide-col" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={sortedTasks.length > 0 && sortedTasks.every(t => selectedTaskIds.has(t.id))}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                {columnOrder.map(col => {
                  if (!visibleColumns[col]) return null;
                  
                  const label = col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ');
                  const isSortable = ['urgency', 'status', 'priority', 'title', 'project', 'ect', 'date_due', 'days_left'].includes(col);
                  const desktopOnly = col !== 'title'; // User wants ONLY task name and due date (due date will be in subtext)
                  const headerClass = (isSortable ? "sortable-header " : "") + (desktopOnly ? "desktop-only-cell" : "");
                  
                  return (
                    <th
                      key={col}
                      className={headerClass}
                      style={{ width: columnWidths[col] }}
                      onClick={isSortable ? () => handleSort(col) : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>
                          {label} {isSortable && <SortIndicator columnKey={col} />}
                        </span>
                        <div
                          className="resizer"
                          onMouseDown={(e) => handleResizeStart(e, col)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  viewMode="desktop"
                  visibleColumns={visibleColumns}
                  columnOrder={columnOrder}
                  columnWidths={columnWidths}
                  isSelected={selectedTaskIds.has(task.id)}
                  onToggleSelect={toggleSelect}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  projects={projects}
                  areas={areas}
                  createProject={createProject}
                />
              ))}
            </tbody>
          </table>
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
