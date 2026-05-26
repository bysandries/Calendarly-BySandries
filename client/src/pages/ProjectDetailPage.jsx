import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas, fetchTasks, fetchProjectSettings, updateProjectSettings } from '../utils/api';
import { getStatusInfo, GTD_STATUSES, TASK_TABS, PRIORITY_COLORS } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency, formatIsoDateShort } from '../lib/taskMath';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import ProjectPicker from '../components/ProjectPicker';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';
import PersonPicker from '../components/PersonPicker';

const PALM_PHASES = ['Plan', 'Act', 'Measure', 'Learn', 'Ignored'];

const DEFAULT_VISIBLE_COLUMNS = {
  starred: true,
  urgency: true,
  status: true,
  priority: true,
  title: true,
  project: false,
  ect: true,
  date_due: true,
  days_left: true,
  notes: true,
  actions: false,
  assignee: true,
};

const DEFAULT_COLUMN_ORDER = [
  'starred', 'urgency', 'status', 'priority', 'title', 'project', 'assignee', 'ect', 'date_due', 'days_left', 'notes', 'actions'
];

const DEFAULT_COLUMN_WIDTHS = {
  starred: 40,
  urgency: 100,
  status: 130,
  priority: 80,
  title: 300,
  project: 180,
  assignee: 120,
  ect: 90,
  date_due: 130,
  days_left: 90,
  notes: 40,
  actions: 60,
};

const COLUMN_LABEL = (col) => col === 'ect' ? 'ECT' : col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ');

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, updateProject, createProject } = useProjects();
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask, refetch } = useTasks({ project_id: id });
  const { people } = usePeople();
  const [areas, setAreas] = useState([]);
  const [activeTab, setActiveTab] = useState('actionable');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 0, estimated_minutes: '' });
  
  // Selection & Drawer State
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Project editing state
  const [editingProjectTitle, setEditingProjectTitle] = useState(false);
  const [editingProjectDesc, setEditingProjectDesc] = useState(false);
  const [editingProjectGoals, setEditingProjectGoals] = useState(false);

  // Column config for TaskCard — persisted per-project via /api/projects/:id/settings
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const resizingColumn = useRef(null);

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

  // Global handlers for column resize drag (mirrors TasksPage)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingColumn.current) return;
      const { key, startX, startWidth } = resizingColumn.current;
      const deltaX = e.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [key]: Math.max(50, startWidth + deltaX),
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
      startWidth: columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 100,
    };
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const filters = { project_id: id };
    refetch(filters);
  }, [id]);

  // Load per-project column settings whenever the project changes.
  // Reset to defaults first so we never leak the previous project's state into the new one.
  useEffect(() => {
    if (!id) return;
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    fetchProjectSettings(id)
      .then(({ visible_columns, column_order }) => {
        if (visible_columns && typeof visible_columns === 'object') {
          // Merge defaults so any newly-introduced column has a sensible default
          setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS, ...visible_columns });
        }
        if (Array.isArray(column_order) && column_order.length > 0) {
          // Append any default columns not present in saved order (forward-compat)
          const merged = [...column_order];
          DEFAULT_COLUMN_ORDER.forEach(col => {
            if (!merged.includes(col)) merged.push(col);
          });
          setColumnOrder(merged);
        }
      })
      .catch(() => {});
  }, [id]);

  const persistSettings = (nextVisible, nextOrder) => {
    if (!id) return;
    updateProjectSettings(id, {
      visible_columns: nextVisible,
      column_order: nextOrder,
    }).catch(err => console.error('Failed to save project settings:', err));
  };

  const toggleColumnVisibility = (col) => {
    const next = { ...visibleColumns, [col]: !visibleColumns[col] };
    setVisibleColumns(next);
    persistSettings(next, columnOrder);
  };

  const moveColumn = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= columnOrder.length) return;
    const next = [...columnOrder];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setColumnOrder(next);
    persistSettings(visibleColumns, next);
  };

  const handleColumnDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleColumnDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const next = [...columnOrder];
    const item = next.splice(draggedIndex, 1)[0];
    next.splice(index, 0, item);
    setColumnOrder(next);
    setDraggedIndex(index);
  };

  const handleColumnDragEnd = () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);
    // Read latest order via functional setter, then persist.
    setColumnOrder(prev => {
      persistSettings(visibleColumns, prev);
      return prev;
    });
  };

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

  const handleTaskClick = (e, id, index) => {
    const isShift = e.shiftKey;
    const isCmdCtrl = e.metaKey || e.ctrlKey;

    setSelectedTaskIds(prev => {
      const next = new Set(prev);

      if (isShift && lastSelectedIndex !== null) {
        // Range selection
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeSet = new Set(prev);
        sortedTasks.slice(start, end + 1).forEach(t => rangeSet.add(t.id));
        return rangeSet;
      } else if (isCmdCtrl) {
        // Additive toggle
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        // Single selection
        return new Set([id]);
      }
      return next;
    });

    setLastSelectedIndex(index);
  };

  const toggleSelectionOne = (taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
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

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
    setLastSelectedIndex(null);
  };

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

  const visibleTasks = tasks.filter(t => t.status !== '00 - Not Actionable');

  const activeTabDef = TASK_TABS.find(t => t.key === activeTab);
  const filteredTasks = activeTab === 'priorities'
    ? tasks.filter(t => t.is_starred)
    : (activeTabDef
        ? visibleTasks.filter(t => activeTabDef.statuses.includes(t.status))
        : visibleTasks);

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
      case 'assignee': {
        const pA = people.find(p => p.id === a.person_id);
        const pB = people.find(p => p.id === b.person_id);
        cmp = (pA?.name || '').localeCompare(pB?.name || '');
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

  const selectedTasks = sortedTasks.filter(t => selectedTaskIds.has(t.id));

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
            {editingProjectTitle ? (
              <input
                className="inline-edit"
                defaultValue={project.title}
                autoFocus
                onBlur={async (e) => {
                  setEditingProjectTitle(false);
                  if (e.target.value && e.target.value !== project.title) {
                    await updateProject(project.id, { title: e.target.value });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  else if (e.key === 'Escape') setEditingProjectTitle(false);
                }}
                style={{ fontSize: '1.3rem', fontWeight: 700, width: '100%', marginBottom: '4px' }}
              />
            ) : (
              <h2
                style={{ marginBottom: '4px', fontSize: '1.3rem', cursor: 'pointer' }}
                onClick={() => setEditingProjectTitle(true)}
                title="Click to edit title"
              >
                {project.title}
              </h2>
            )}

            {editingProjectDesc ? (
              <textarea
                className="form-input"
                defaultValue={project.description}
                autoFocus
                rows="3"
                onBlur={async (e) => {
                  setEditingProjectDesc(false);
                  if (e.target.value !== project.description) {
                    await updateProject(project.id, { description: e.target.value });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingProjectDesc(false);
                }}
                style={{ width: '100%', fontSize: '0.9rem' }}
              />
            ) : (
              <p
                className="page-description"
                style={{ marginBottom: 0, cursor: 'pointer', minHeight: '1.2em' }}
                onClick={() => setEditingProjectDesc(true)}
                title="Click to edit description"
              >
                {project.description || 'Add a description...'}
              </p>
            )}
          </div>
          <ProjectStatusBadge
            status={project.status}
            onChange={(newStatus) => updateProject(project.id, { status: newStatus })}
          />
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Person</div>
            <PersonPicker
              value={project.person_id}
              onSelect={(val) => updateProject(project.id, { person_id: val })}
            />
          </div>

          {/* Due date */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Due Date</div>
            <input
              type="date"
              className="form-input"
              style={{ padding: '3px 10px', height: 'auto', fontSize: '0.82rem', width: '100%' }}
              value={project.due_date || ''}
              onChange={(e) => updateProject(project.id, { due_date: e.target.value || null })}
            />
          </div>

          {/* Start date */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Start Date</div>
            <input
              type="date"
              className="form-input"
              style={{ padding: '3px 10px', height: 'auto', fontSize: '0.82rem', width: '100%' }}
              value={project.start_date || ''}
              onChange={(e) => updateProject(project.id, { start_date: e.target.value || null })}
            />
          </div>

          {/* End date */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>End Date</div>
            <input
              type="date"
              className="form-input"
              style={{ padding: '3px 10px', height: 'auto', fontSize: '0.82rem', width: '100%' }}
              value={project.end_date || ''}
              onChange={(e) => updateProject(project.id, { end_date: e.target.value || null })}
            />
          </div>

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
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Goals Aligned</div>
          {editingProjectGoals ? (
            <input
              className="form-input"
              defaultValue={Array.isArray(project.goals_aligned) ? project.goals_aligned.join(', ') : project.goals_aligned || ''}
              autoFocus
              onBlur={async (e) => {
                setEditingProjectGoals(false);
                const next = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                if (JSON.stringify(next) !== JSON.stringify(project.goals_aligned)) {
                  await updateProject(project.id, { goals_aligned: next });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                else if (e.key === 'Escape') setEditingProjectGoals(false);
              }}
              placeholder="Enter goals separated by commas..."
              style={{ width: '100%' }}
            />
          ) : (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', cursor: 'pointer', minHeight: '24px' }}
              onClick={() => setEditingProjectGoals(true)}
              title="Click to edit goals"
            >
              {Array.isArray(project.goals_aligned) && project.goals_aligned.length > 0 ? (
                project.goals_aligned.map((g, i) => (
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
                ))
              ) : (
                <span style={{ color: 'var(--text-dimmed)', fontSize: '0.82rem' }}>Add goals aligned with this project...</span>
              )}
            </div>
          )}
        </div>

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
      </div>

      {/* Task Table */}
      {tasksLoading ? (
        <div className="glass-panel" style={{ marginBottom: '16px' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="glass-panel" style={{ marginBottom: '16px' }}>
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>No tasks in this tab</h3>
            <p>Add a task with the + button or link existing tasks.</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel data-table-wrapper" style={{ marginBottom: '16px' }}>
          <div className="mobile-hide" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button
                className="btn-icon"
                onClick={() => setShowColumnPicker(v => !v)}
                title="Manage columns"
                aria-label="Manage columns"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {showColumnPicker && (
                <div className="glass-panel glass-panel-strong" style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  zIndex: 200,
                  padding: '16px',
                  minWidth: '240px',
                  boxShadow: 'var(--shadow-xl)',
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
                        onDragStart={(e) => handleColumnDragStart(e, index)}
                        onDragOver={(e) => handleColumnDragOver(e, index)}
                        onDragEnd={handleColumnDragEnd}
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
                          checked={!!visibleColumns[col]}
                          onChange={() => toggleColumnVisibility(col)}
                        />
                        <span style={{ fontSize: '0.85rem', color: visibleColumns[col] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {COLUMN_LABEL(col)}
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
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={sortedTasks.length > 0 && sortedTasks.every(t => selectedTaskIds.has(t.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                {columnOrder.map(col => {
                  if (!visibleColumns[col]) return null;
                  const isSortable = ['urgency', 'status', 'priority', 'title', 'assignee', 'ect', 'date_due', 'days_left'].includes(col);
                  return (
                    <th
                      key={col}
                      className={(isSortable ? 'sortable-header ' : '') + 'desktop-only-cell'}
                      style={{ width: columnWidths[col] }}
                      onClick={isSortable ? () => handleSort(col) : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>
                          {COLUMN_LABEL(col)} {isSortable && <SortIndicator columnKey={col} />}
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
                  onSelectionToggle={toggleSelectionOne}
                  projects={projects}
                  people={people}
                  areas={areas}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {/* Task Drawer */}
      <TaskDrawer
        tasks={selectedTasks}
        projects={projects}
        areas={areas}
        onSave={updateTask}
        onDelete={deleteTask}
        onClose={clearSelection}
      />

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
