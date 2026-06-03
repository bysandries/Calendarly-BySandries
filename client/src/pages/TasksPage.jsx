import { useState, useEffect, useRef, useCallback } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas } from '../utils/api/areas';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';
import { getStatusInfo, GTD_STATUSES, TASK_TABS } from '../utils/statusMap';
import { calcDaysLeft, calcUrgency } from '../lib/taskMath';

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, refetch, fetchTrash, restoreTask, hardDeleteTask, emptyTrash } = useTasks();
  const { projects, createProject } = useProjects();
  const { people } = usePeople();
  const [areas, setAreas] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [activeTab, setActiveTab] = useState('actionable');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', project_id: '', priority: 0, estimated_minutes: '' });

  // Selection & Drawer State
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState({
    starred: true, urgency: true, status: true, priority: true, title: true,
    project: true, ect: true, date_due: true, days_left: true, notes: false, actions: true, assignee: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    'starred', 'urgency', 'status', 'priority', 'title', 'project', 'assignee', 'ect', 'date_due', 'days_left', 'notes', 'actions'
  ]);
  const [columnWidths, setColumnWidths] = useState({
    starred: 40, urgency: 100, status: 130, priority: 80, title: 300,
    project: 180, assignee: 120, ect: 90, date_due: 130, days_left: 90, notes: 40, actions: 60,
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const resizingColumn = useRef(null);

  // Trash state
  const [trashItems, setTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);

  // Undo toast state
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef(toasts);
  useEffect(() => { toastsRef.current = toasts; }, [toasts]);

  // ── Column resize ──
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingColumn.current) return;
      const { key, startX, startWidth } = resizingColumn.current;
      const deltaX = e.clientX - startX;
      setColumnWidths(prev => ({ ...prev, [key]: Math.max(50, startWidth + deltaX) }));
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
    resizingColumn.current = { key, startX: e.clientX, startWidth: columnWidths[key] };
    document.body.style.cursor = 'col-resize';
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newOrder = [...columnOrder];
    const item = newOrder.splice(draggedIndex, 1)[0];
    newOrder.splice(index, 0, item);
    setColumnOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const moveColumn = (index, direction) => {
    const newOrder = [...columnOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setColumnOrder(newOrder);
  };

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    const filters = {};
    if (projectFilter) filters.project_id = projectFilter;
    refetch(filters);
  }, [projectFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load trash when tab switches to it
  useEffect(() => {
    if (activeTab === 'trash') {
      setTrashLoading(true);
      fetchTrash().then(data => {
        setTrashItems(Array.isArray(data) ? data : []);
      }).catch(() => {
        setTrashItems([]);
      }).finally(() => setTrashLoading(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Undo toast helpers ──
  const dismissToast = useCallback((toastId) => {
    const toast = toastsRef.current.find(t => t.id === toastId);
    if (toast?.timer) clearTimeout(toast.timer);
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  const deleteWithUndo = useCallback(async (id) => {
    const taskSnapshot = tasks.find(t => t.id === id);
    await deleteTask(id);

    const toastId = `toast-${Date.now()}-${id}`;
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 5000);

    setToasts(prev => [...prev, {
      id: toastId,
      message: taskSnapshot ? `"${taskSnapshot.title.slice(0, 40)}" moved to Trash` : 'Task moved to Trash',
      taskId: id,
      timer,
    }]);
  }, [tasks, deleteTask]);

  const handleUndoDelete = useCallback(async (toastId, taskId) => {
    dismissToast(toastId);
    try {
      await restoreTask(taskId);
      refetch();
    } catch {
      // restore failed — task still in trash, user can use Trash tab
    }
  }, [dismissToast, restoreTask, refetch]);

  // ── Trash tab actions ──
  const handleRestoreFromTrash = async (id) => {
    await restoreTask(id);
    setTrashItems(prev => prev.filter(t => t.id !== id));
    refetch();
  };

  const handleHardDelete = async (id) => {
    await hardDeleteTask(id);
    setTrashItems(prev => prev.filter(t => t.id !== id));
  };

  const handleEmptyTrash = async () => {
    await emptyTrash();
    setTrashItems([]);
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

  const handleTaskClick = (e, id, index) => {
    const isShift = e.shiftKey;
    const isCmdCtrl = e.metaKey || e.ctrlKey || isSelectMode;

    setSelectedTaskIds(prev => {
      if (isShift && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeSet = new Set(prev);
        sortedTasks.slice(start, end + 1).forEach(t => rangeSet.add(t.id));
        return rangeSet;
      } else if (isCmdCtrl) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      } else {
        return new Set([id]);
      }
    });

    setLastSelectedIndex(index);
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
    setLastSelectedIndex(null);
  };

  const visibleTasks = tasks.filter(t => t.status !== '00 - Not Actionable');
  const activeTabDef = TASK_TABS.find(t => t.key === activeTab);

  const filteredTasks = activeTab === 'priorities'
    ? tasks.filter(t => t.is_starred)
    : (activeTabDef
        ? visibleTasks.filter(t => activeTabDef.statuses.includes(t.status))
        : visibleTasks);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
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
        cmp = idxA - idxB; break;
      }
      case 'priority': cmp = a.priority - b.priority; break;
      case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'project': {
        const pA = projects.find(p => p.id === a.project_id);
        const pB = projects.find(p => p.id === b.project_id);
        cmp = (pA?.title || '').localeCompare(pB?.title || ''); break;
      }
      case 'assignee': {
        const pA = people.find(p => p.id === a.person_id);
        const pB = people.find(p => p.id === b.person_id);
        cmp = (pA?.name || '').localeCompare(pB?.name || ''); break;
      }
      case 'date_due': {
        if (!a.date_due && !b.date_due) cmp = 0;
        else if (!a.date_due) cmp = 1;
        else if (!b.date_due) cmp = -1;
        else cmp = new Date(a.date_due) - new Date(b.date_due);
        break;
      }
      case 'ect': cmp = (a.estimated_minutes || 0) - (b.estimated_minutes || 0); break;
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
        cmp = sA - sB; break;
      }
      default: cmp = 0;
    }
    return sortConfig.direction === 'asc' ? cmp : -cmp;
  });

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const selectedTasks = sortedTasks.filter(t => selectedTaskIds.has(t.id));

  return (
    <div>
      <div className="page-header">
        <h2>Tasks</h2>
        <p className="page-description">Click to select — Use Shift or Cmd/Ctrl for multiple — Side drawer for editing</p>
      </div>

      {/* Undo Toast Stack */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
        }}>
          {toasts.map(toast => (
            <div key={toast.id} style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              background: 'rgba(20,20,28,0.95)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px', padding: '10px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontSize: '13px', color: 'var(--text-secondary)',
              animation: 'fadeSlideUp 0.2s ease',
            }}>
              <span>🗑 {toast.message}</span>
              <button
                onClick={() => handleUndoDelete(toast.id, toast.taskId)}
                style={{
                  background: 'none', border: '1px solid var(--accent-primary)',
                  borderRadius: '6px', padding: '3px 10px', cursor: 'pointer',
                  color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600,
                }}
              >
                Undo
              </button>
              <button
                onClick={() => dismissToast(toast.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="filter-bar">
        <div className="task-tabs desktop-only">
          {TASK_TABS.map(tab => {
            const count = tab.key === 'priorities'
              ? tasks.filter(t => t.is_starred).length
              : visibleTasks.filter(t => tab.statuses.includes(t.status)).length;
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
          <button
            className={`task-tab ${activeTab === 'trash' ? 'active' : ''}`}
            onClick={() => setActiveTab('trash')}
            style={{ color: activeTab === 'trash' ? 'var(--accent-danger)' : 'var(--text-muted)' }}
          >
            Trash
          </button>
        </div>

        <div className="task-status-mobile-menu mobile-only">
          <select
            id="mobile-status-select"
            className="form-select"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {TASK_TABS.map(tab => {
              const count = tab.key === 'priorities'
                ? tasks.filter(t => t.is_starred).length
                : visibleTasks.filter(t => tab.statuses.includes(t.status)).length;
              return (
                <option key={tab.key} value={tab.key}>{tab.label} ({count})</option>
              );
            })}
            <option value="trash">Trash</option>
          </select>
        </div>

        {activeTab !== 'trash' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${isSelectMode ? 'btn-primary' : 'btn-ghost'} mobile-only`}
              onClick={() => setIsSelectMode(!isSelectMode)}
            >
              {isSelectMode ? 'Cancel Select' : 'Select Mode'}
            </button>
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
        )}
      </div>

      {/* ── Trash View ── */}
      {activeTab === 'trash' && (
        <div>
          <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in Trash
            </span>
            {trashItems.length > 0 && (
              <button
                className="btn btn-ghost"
                onClick={handleEmptyTrash}
                style={{ color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)', fontSize: '12px' }}
              >
                Empty Trash
              </button>
            )}
          </div>

          {trashLoading ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : trashItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🗑</div>
              <h3 style={{ color: 'var(--text-primary)' }}>Trash is Empty</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Deleted tasks appear here for recovery.</p>
            </div>
          ) : (
            trashItems.map(task => (
              <div key={task.id} className="glass-panel" style={{
                padding: '14px 20px', marginBottom: '8px',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderLeft: '4px solid var(--accent-danger)',
                opacity: 0.8,
              }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{task.title}</h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Deleted: {new Date(task.deleted_at).toLocaleString()} · Status was: {task.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRestoreFromTrash(task.id)}
                    style={{ borderColor: 'var(--accent-success)', color: 'var(--accent-success)' }}
                  >
                    ↩ Restore
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleHardDelete(task.id)}
                    style={{ color: 'var(--accent-danger)' }}
                    title="Permanently delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Normal Task Views ── */}
      {activeTab !== 'trash' && (
        <>
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
                      position: 'absolute', right: 0, top: '100%', zIndex: 200,
                      padding: '16px', minWidth: '240px', boxShadow: 'var(--shadow-xl)',
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Manage Columns
                      </div>
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {columnOrder.map((col, index) => (
                          <div
                            key={col}
                            className={`column-picker-item ${draggedIndex === index ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="drag-handle" title="Drag to reorder">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
                                <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
                                <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
                                <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
                                <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
                                <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
                              </svg>
                            </div>
                            <input
                              type="checkbox"
                              checked={visibleColumns[col]}
                              onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }))}
                            />
                            <span style={{ fontSize: '0.85rem', color: visibleColumns[col] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ')}
                            </span>
                            <div className="column-reorder-btns">
                              <button className="reorder-btn" onClick={() => moveColumn(index, -1)} disabled={index === 0} title="Move Up">▲</button>
                              <button className="reorder-btn" onClick={() => moveColumn(index, 1)} disabled={index === columnOrder.length - 1} title="Move Down">▼</button>
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
                    {columnOrder.map(col => {
                      if (!visibleColumns[col]) return null;
                      const label = col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ');
                      const isSortable = ['urgency', 'status', 'priority', 'title', 'project', 'assignee', 'ect', 'date_due', 'days_left'].includes(col);
                      const desktopOnly = col !== 'title';
                      const headerClass = (isSortable ? 'sortable-header ' : '') + (desktopOnly ? 'desktop-only-cell' : '');
                      return (
                        <th
                          key={col}
                          className={headerClass}
                          style={{ width: columnWidths[col] }}
                          onClick={isSortable ? () => handleSort(col) : undefined}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{label} {isSortable && <SortIndicator columnKey={col} />}</span>
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
                  {sortedTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      viewMode="desktop"
                      visibleColumns={visibleColumns}
                      columnOrder={columnOrder}
                      isSelected={selectedTaskIds.has(task.id)}
                      onClick={(e) => handleTaskClick(e, task.id, index)}
                      onUpdateTask={updateTask}
                      projects={projects}
                      people={people}
                      areas={areas}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Task Drawer */}
      <TaskDrawer
        tasks={selectedTasks}
        projects={projects}
        areas={areas}
        onSave={updateTask}
        onDelete={deleteWithUndo}
        onClose={clearSelection}
      />

      {/* FAB */}
      {activeTab !== 'trash' && (
        <button
          className="fab"
          onClick={() => setShowCreateForm(!showCreateForm)}
          title="Add new task"
        >
          +
        </button>
      )}
    </div>
  );
}
