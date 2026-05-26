import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas, fetchTasks, updateTask } from '../utils/api';
import ProjectCard from '../components/ProjectCard';
import ProjectDrawer from '../components/ProjectDrawer';
import { calcProgression } from '../lib/taskMath';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const PALM_PHASE_ORDER = ['Plan', 'Act', 'Measure', 'Learn', 'Ignored'];
const PROJECT_STATUS_ORDER = ['active', 'on-hold', 'completed', 'archived'];

const COLUMN_LABELS = {
  status:       'Status',
  title:        'Title',
  phase:        'Phase',
  pillar:       'Pillar',
  area:         'Area',
  assignee:     'Assignee',
  due_date:     'Due Date',
  start_date:   'Start Date',
  progression:  'Progress',
  time_invested:'Time Invested',
  importance:   'Importance',
  notes:        'Notes',
};

const SORTABLE_COLUMNS = new Set([
  'status', 'title', 'phase', 'pillar', 'area', 'assignee',
  'due_date', 'start_date', 'progression', 'time_invested', 'importance',
]);

export default function ProjectsPage() {
  const { projects, loading, error, updateProject, deleteProject, refetch } = useProjects();
  const { people } = usePeople();
  const [areas, setAreas] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');

  // Selection state
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Column state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState({
    status:        true,
    title:         true,
    phase:         true,
    pillar:        false,
    area:          true,
    assignee:      true,
    due_date:      true,
    start_date:    false,
    progression:   true,
    time_invested: true,
    importance:    true,
    notes:         true,
  });
  const [columnOrder, setColumnOrder] = useState([
    'status', 'title', 'phase', 'pillar', 'area', 'assignee',
    'due_date', 'start_date', 'progression', 'time_invested', 'importance', 'notes',
  ]);
  const [columnWidths, setColumnWidths] = useState({
    status:        110,
    title:         280,
    phase:         85,
    pillar:        100,
    area:          100,
    assignee:      120,
    due_date:      100,
    start_date:    100,
    progression:   140,
    time_invested: 90,
    importance:    95,
    notes:         50,
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const resizingColumn = useRef(null);

  // Unassigned tasks panel
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedTasks, setUnassignedTasks] = useState([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTasks({ unassigned: 'true' })
      .then(data => setUnassignedCount(data.length))
      .catch(() => {});
  }, []);

  // Column resize
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

  // Column drag-to-reorder
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
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setColumnOrder(newOrder);
  };

  // Unassigned tasks
  const fetchUnassigned = useCallback(async (q = '') => {
    setUnassignedLoading(true);
    try {
      const data = await fetchTasks({ unassigned: 'true', q: q || undefined });
      setUnassignedTasks(data);
      setUnassignedCount(data.length);
    } catch {
      setUnassignedTasks([]);
    } finally {
      setUnassignedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showUnassigned) fetchUnassigned(unassignedSearch);
  }, [showUnassigned]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssignTask = async (taskId, projectId) => {
    if (!projectId) return;
    await updateTask(taskId, { project_id: projectId });
    fetchUnassigned(unassignedSearch);
    refetch();
  };

  const getAreaInfo = useCallback((areaId) => areas.find(a => a.id === areaId), [areas]);

  // Filtering
  const visibleProjects = useMemo(() => {
    return statusFilter ? projects.filter(p => p.status === statusFilter) : projects;
  }, [projects, statusFilter]);

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => {
      if (!sortConfig.key) return 0;
      let cmp = 0;
      switch (sortConfig.key) {
        case 'status': {
          const iA = PROJECT_STATUS_ORDER.indexOf(a.status);
          const iB = PROJECT_STATUS_ORDER.indexOf(b.status);
          cmp = (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
          break;
        }
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'phase': {
          const iA = PALM_PHASE_ORDER.indexOf(a.phase);
          const iB = PALM_PHASE_ORDER.indexOf(b.phase);
          cmp = (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
          break;
        }
        case 'pillar':
          cmp = (a.pillar || '').localeCompare(b.pillar || '');
          break;
        case 'area':
          cmp = (a.area || '').localeCompare(b.area || '');
          break;
        case 'assignee': {
          const pA = people.find(p => p.id === a.person_id);
          const pB = people.find(p => p.id === b.person_id);
          cmp = (pA?.name || '').localeCompare(pB?.name || '');
          break;
        }
        case 'due_date': {
          if (!a.due_date && !b.due_date) cmp = 0;
          else if (!a.due_date) cmp = 1;
          else if (!b.due_date) cmp = -1;
          else cmp = new Date(a.due_date) - new Date(b.due_date);
          break;
        }
        case 'start_date': {
          if (!a.start_date && !b.start_date) cmp = 0;
          else if (!a.start_date) cmp = 1;
          else if (!b.start_date) cmp = -1;
          else cmp = new Date(a.start_date) - new Date(b.start_date);
          break;
        }
        case 'progression': {
          const pctA = calcProgression(a.complete_tasks ?? 0, a.total_tasks ?? 0) ?? -1;
          const pctB = calcProgression(b.complete_tasks ?? 0, b.total_tasks ?? 0) ?? -1;
          cmp = pctA - pctB;
          break;
        }
        case 'time_invested':
          cmp = (a.pomodoro_minutes ?? 0) - (b.pomodoro_minutes ?? 0);
          break;
        case 'importance':
          cmp = (a.total_tasks ?? 0) - (b.total_tasks ?? 0);
          break;
        default:
          cmp = 0;
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [visibleProjects, sortConfig, people]);

  // Selection
  const handleProjectClick = (e, id, index) => {
    const isShift = e.shiftKey;
    const isCmdCtrl = e.metaKey || e.ctrlKey;

    if (isShift && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = new Set(sortedProjects.slice(start, end + 1).map(p => p.id));
      setSelectedProjectIds(rangeIds);
    } else if (isCmdCtrl) {
      setSelectedProjectIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedProjectIds(new Set([id]));
    }
    setLastSelectedIndex(index);
  };

  const handleCheckboxToggle = (e, id, index) => {
    e.stopPropagation();
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedIndex(index);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProjectIds(new Set(sortedProjects.map(p => p.id)));
    } else {
      setSelectedProjectIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedProjectIds(new Set());
    setLastSelectedIndex(null);
  };

  const selectedProjects = useMemo(() => {
    const result = projects.filter(p => selectedProjectIds.has(p.id));
    if (selectedProjectIds.has(null)) result.push({ id: null });
    return result;
  }, [projects, selectedProjectIds]);

  // Delete / archive
  const handleDeleteClick = async (target) => {
    const targets = Array.isArray(target) ? target : [target];
    const archivedOnly = targets.every(p => p.status === 'archived');
    if (archivedOnly) {
      setConfirmDelete({
        projects: targets,
        taskCount: targets.reduce((acc, p) => acc + (p.total_tasks || 0), 0),
      });
    } else {
      if (confirm(`Archive ${targets.length > 1 ? targets.length + ' projects' : 'this project'}?`)) {
        for (const p of targets) await deleteProject(p.id);
        clearSelection();
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    for (const p of confirmDelete.projects) await deleteProject(p.id);
    setConfirmDelete(null);
    clearSelection();
  };

  const handleDrawerSave = () => {
    refetch();
    clearSelection();
  };

  const handleAreasChanged = async () => {
    const updated = await fetchAreas();
    setAreas(updated);
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2>Projects</h2>
        <p className="page-description">
          Click to select — Shift or Cmd/Ctrl for multi-select — Side drawer for editing
        </p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-pills">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`filter-pill ${statusFilter === opt.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
              {opt.value !== '' && (
                <span style={{ marginLeft: '5px', opacity: 0.55, fontSize: '0.7rem' }}>
                  {projects.filter(p => p.status === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          className={`filter-pill ${showUnassigned ? 'active' : ''}`}
          onClick={() => setShowUnassigned(v => !v)}
          style={{ marginLeft: 'auto' }}
        >
          Unassigned Tasks
          {unassignedCount > 0 && (
            <span style={{ marginLeft: '5px', opacity: 0.7, fontSize: '0.7rem' }}>{unassignedCount}</span>
          )}
        </button>
      </div>

      {/* Unassigned tasks panel */}
      {showUnassigned && (
        <div className="glass-panel" style={{ marginBottom: '20px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="Search unassigned tasks…"
              value={unassignedSearch}
              onChange={(e) => setUnassignedSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUnassigned(unassignedSearch)}
              style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem' }}
            />
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => fetchUnassigned(unassignedSearch)}>
              Search
            </button>
          </div>
          {unassignedLoading ? (
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.85rem', padding: '8px 0' }}>Loading…</div>
          ) : unassignedTasks.length === 0 ? (
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.85rem', padding: '8px 0' }}>
              No unassigned tasks{unassignedSearch ? ' matching your search' : ''}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
              {unassignedTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px', borderRadius: 'var(--radius-xs)',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {task.status?.replace(/^\d+ - /, '') || ''}
                  </span>
                  <select
                    className="form-select"
                    defaultValue=""
                    style={{ padding: '2px 8px', fontSize: '0.75rem', minWidth: '120px', height: 'auto' }}
                    onChange={(e) => handleAssignTask(task.id, e.target.value)}
                  >
                    <option value="" disabled>Assign to…</option>
                    {projects.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-panel">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-danger)' }}>
          Error loading projects: {error}
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-icon">◆</div>
            <h3>{statusFilter ? `No ${statusFilter} projects` : 'No projects yet'}</h3>
            <p>{statusFilter ? 'Try a different filter.' : 'Create your first project.'}</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel data-table-wrapper">
          {/* Column picker */}
          <div className="mobile-hide" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button
                className="btn-icon"
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                title="Manage Columns"
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
                          {COLUMN_LABELS[col] || col}
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
                {/* Checkbox header */}
                <th style={{ width: '40px', textAlign: 'center' }} className="desktop-only-cell">
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={selectedProjectIds.size === sortedProjects.length && sortedProjects.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                {columnOrder.map(col => {
                  if (!visibleColumns[col]) return null;
                  const isSortable = SORTABLE_COLUMNS.has(col);
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
                        <span>
                          {COLUMN_LABELS[col]} {isSortable && <SortIndicator columnKey={col} />}
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
              {sortedProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  visibleColumns={visibleColumns}
                  columnOrder={columnOrder}
                  isSelected={selectedProjectIds.has(project.id)}
                  onClick={(e) => handleProjectClick(e, project.id, index)}
                  onCheckboxToggle={(e) => handleCheckboxToggle(e, project.id, index)}
                  updateProject={updateProject}
                  people={people}
                  getAreaInfo={getAreaInfo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile list */}
      {!loading && !error && sortedProjects.length > 0 && (
        <div className="projects-mobile-list">
          {sortedProjects.map(project => {
            const area = getAreaInfo(project.area);
            const total = project.total_tasks ?? 0;
            const done = project.complete_tasks ?? 0;
            const pct = calcProgression(done, total);
            const isSelected = selectedProjectIds.has(project.id);
            return (
              <div
                key={project.id}
                className={`project-mobile-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedProjectIds(new Set([project.id]))}
              >
                <div className="project-mobile-header">
                  <span className="project-mobile-title" style={{ borderLeft: `4px solid ${area?.color_hex || '#95A5A6'}`, paddingLeft: '12px' }}>
                    {project.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--glass-bg-strong)' }}>
                    {project.status}
                  </span>
                </div>
                <div className="project-mobile-meta">
                  <div className="project-mobile-stat">
                    <span>Phase:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{project.phase || '—'}</span>
                  </div>
                  <div className="project-mobile-stat">
                    <span>Progress:</span>
                    <span style={{ fontWeight: 600, color: pct === 100 ? '#2ECC71' : 'var(--accent-primary)' }}>{pct ?? 0}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permanent-delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--accent-danger)' }}>Permanently Delete Projects</h3>
              <button className="btn-icon" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div style={{ padding: '4px 0 20px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                You are about to permanently delete {confirmDelete.projects.length} project{confirmDelete.projects.length !== 1 ? 's' : ''}:
              </p>
              <ul style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '16px', color: 'var(--text-primary)', fontSize: '0.9rem', paddingLeft: '20px' }}>
                {confirmDelete.projects.map(p => <li key={p.id}>{p.title}</li>)}
              </ul>
              {confirmDelete.taskCount > 0 && (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)',
                  color: 'var(--accent-danger)', fontSize: '0.85rem', marginBottom: '16px',
                }}>
                  This will also permanently delete {confirmDelete.taskCount} task{confirmDelete.taskCount !== 1 ? 's' : ''} linked to these projects.
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                These records will be moved to the deleted records archive. This cannot be undone.
              </p>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn"
                onClick={handleConfirmDelete}
                style={{ background: 'rgba(231,76,60,0.15)', color: 'var(--accent-danger)', borderColor: 'rgba(231,76,60,0.3)' }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project drawer */}
      <ProjectDrawer
        projects={selectedProjects}
        onSave={handleDrawerSave}
        onDelete={handleDeleteClick}
        onClose={clearSelection}
        onAreasChanged={handleAreasChanged}
      />

      {/* FAB */}
      <button className="fab" onClick={() => setSelectedProjectIds(new Set([null]))} title="Create new project">
        +
      </button>
    </div>
  );
}
