import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas, fetchTasks, updateTask } from '../utils/api';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import ProjectDrawer from '../components/ProjectDrawer';
import { formatIsoDateShort, calcProgression, calcImportance, formatDuration } from '../lib/taskMath';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const IMPORTANCE_COLORS = {
  'importance-none':     'var(--text-dimmed)',
  'importance-low':      '#3498DB',
  'importance-medium':   '#E67E22',
  'importance-high':     '#E74C3C',
  'importance-critical': '#8E44AD',
};

export default function ProjectsPage() {
  const { projects, loading, error, updateProject, deleteProject, refetch } = useProjects();
  const [areas, setAreas] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [drawerProject, setDrawerProject] = useState(null); // null=closed, {}=create, project=edit
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Unassigned tasks panel
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedTasks, setUnassignedTasks] = useState([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  // Fetch unassigned count on mount
  useEffect(() => {
    fetchTasks({ unassigned: 'true' })
      .then(data => setUnassignedCount(data.length))
      .catch(() => {});
  }, []);

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

  const getAreaInfo = (areaId) => areas.find(a => a.id === areaId);

  // Delete / archive flow (can also be triggered from drawer)
  const handleDeleteClick = (project) => {
    if (project.status === 'archived') {
      setConfirmDelete({ project, taskCount: project.total_tasks });
    } else {
      deleteProject(project.id);
      setDrawerProject(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await deleteProject(confirmDelete.project.id);
    setConfirmDelete(null);
    setDrawerProject(null);
  };

  const handleDrawerSave = (saved) => {
    // useProjects already updated its internal state via createProject/updateProject;
    // just close the drawer and refetch to get fresh task stats from the join.
    refetch();
    setDrawerProject(null);
  };

  const handleAreasChanged = async () => {
    const updated = await fetchAreas();
    setAreas(updated);
  };

  const visibleProjects = statusFilter
    ? projects.filter(p => p.status === statusFilter)
    : projects;

  return (
    <div>
      <div className="page-header">
        <h2>Projects</h2>
        <p className="page-description">Manage your projects — track PALM phases, pillars, and aligned goals</p>
      </div>

      {/* Filter pills + Unassigned Tasks toggle */}
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
            <span style={{ marginLeft: '5px', opacity: 0.7, fontSize: '0.7rem' }}>
              {unassignedCount}
            </span>
          )}
        </button>
      </div>

      {/* Unassigned Tasks Panel */}
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
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem' }}
              onClick={() => fetchUnassigned(unassignedSearch)}
            >
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-danger)' }}>
          Error loading projects: {error}
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-icon">◆</div>
            <h3>{statusFilter ? `No ${statusFilter} projects` : 'No projects yet'}</h3>
            <p>{statusFilter ? 'Try a different filter or create a new project.' : 'Create your first project to start organizing your tasks.'}</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Status</th>
                <th>Title</th>
                <th style={{ width: '80px' }}>Phase</th>
                <th style={{ width: '90px' }}>Area</th>
                <th style={{ width: '100px' }}>Persons</th>
                <th style={{ width: '90px' }}>Due</th>
                <th style={{ width: '120px' }}>Progression</th>
                <th style={{ width: '80px' }}>Time Invested</th>
                <th style={{ width: '70px' }}>Importance</th>
                <th style={{ width: '40px' }}></th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map(project => {
                const area = getAreaInfo(project.area);
                const total = project.total_tasks ?? 0;
                const done = project.complete_tasks ?? 0;
                const pct = calcProgression(done, total);
                const importance = calcImportance(total);

                return (
                  <tr
                    key={project.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrawerProject(project)}
                  >
                    {/* Status — stop row-click so badge dropdown works */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <ProjectStatusBadge
                        status={project.status}
                        onChange={(newStatus) => updateProject(project.id, { status: newStatus })}
                      />
                    </td>

                    {/* Title */}
                    <td>
                      <div style={{ position: 'relative', paddingLeft: '12px' }}>
                        <div
                          className="area-strip"
                          style={{ background: area?.color_hex || '#95A5A6' }}
                        />
                        <Link
                          to={`/projects/${project.id}`}
                          style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                          className="project-title-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.title}
                        </Link>
                        {project.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {project.description.substring(0, 70)}{project.description.length > 70 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* PALM Phase */}
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--glass-border)',
                      }}>
                        {project.phase || '—'}
                      </span>
                    </td>

                    {/* Area */}
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="color-swatch" style={{ background: area?.color_hex || '#95A5A6' }} />
                        <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{project.area}</span>
                      </span>
                    </td>

                    {/* Persons */}
                    <td>
                      <span style={{ fontSize: '0.8rem', color: project.person_in_charge ? 'var(--text-primary)' : 'var(--text-dimmed)' }}>
                        {project.person_in_charge || '—'}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatIsoDateShort(project.due_date)}
                      </span>
                    </td>

                    {/* Progression */}
                    <td>
                      {pct === null ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', flexShrink: 0 }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: pct === 100 ? '#2ECC71' : 'var(--accent-primary)',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '30px' }}>
                            {pct}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Time Invested */}
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: (project.pomodoro_minutes ?? 0) > 0 ? 'var(--accent-primary)' : 'var(--text-dimmed)',
                      }}>
                        {formatDuration(project.pomodoro_minutes ?? 0)}
                      </span>
                    </td>

                    {/* Importance */}
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: IMPORTANCE_COLORS[importance.cssClass] }}>
                        {importance.label}
                      </span>
                    </td>

                    {/* Edit */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        onClick={() => setDrawerProject(project)}
                        title="Edit project"
                      >
                        ✎
                      </button>
                    </td>

                    {/* Delete / Archive */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        onClick={() => handleDeleteClick(project)}
                        title={project.status === 'archived' ? 'Permanently delete project' : 'Archive project'}
                        style={project.status === 'archived' ? { color: 'var(--accent-danger)' } : {}}
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

      {/* Permanent-delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--accent-danger)' }}>Permanently Delete Project</h3>
              <button className="btn-icon" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div style={{ padding: '4px 0 20px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                You are about to permanently delete:
              </p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                "{confirmDelete.project.title}"
              </p>
              {confirmDelete.taskCount > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(231, 76, 60, 0.08)',
                  border: '1px solid rgba(231, 76, 60, 0.2)',
                  color: 'var(--accent-danger)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}>
                  This will also permanently delete {confirmDelete.taskCount} task{confirmDelete.taskCount !== 1 ? 's' : ''} linked to this project.
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                The project and its tasks will be moved to the deleted records archive. This cannot be undone.
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

      {/* Project slide-out drawer */}
      <ProjectDrawer
        project={drawerProject}
        onSave={handleDrawerSave}
        onDelete={handleDeleteClick}
        onClose={() => setDrawerProject(null)}
        onAreasChanged={handleAreasChanged}
      />

      {/* FAB */}
      <button className="fab" onClick={() => setDrawerProject({})} title="Create new project">
        +
      </button>
    </div>
  );
}
