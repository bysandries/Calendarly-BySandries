import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas, fetchTasks, updateTask } from '../utils/api';
import ProjectCard from '../components/ProjectCard';
import ProjectDrawer from '../components/ProjectDrawer';
import { formatIsoDateShort, calcProgression } from '../lib/taskMath';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export default function ProjectsPage() {
  const { projects, loading, error, updateProject, deleteProject, refetch } = useProjects();
  const [areas, setAreas] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const getAreaInfo = useCallback((areaId) => areas.find(a => a.id === areaId), [areas]);

  const visibleProjects = useMemo(() => {
    return statusFilter
      ? projects.filter(p => p.status === statusFilter)
      : projects;
  }, [projects, statusFilter]);

  const handleProjectClick = (project) => {
    setSelectedProjectIds(new Set([project.id]));
  };

  const handleSelect = (id, index) => {
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
      setSelectedProjectIds(new Set(visibleProjects.map(p => p.id)));
    } else {
      setSelectedProjectIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedProjectIds(new Set());
    setLastSelectedIndex(null);
  };

  const selectedProjects = useMemo(() => {
    const selected = projects.filter(p => selectedProjectIds.has(p.id));
    if (selectedProjectIds.has(null)) {
      selected.push({ id: null }); // Marker for creation mode
    }
    return selected;
  }, [projects, selectedProjectIds]);

  // Delete / archive flow
  const handleDeleteClick = async (target) => {
    const targets = Array.isArray(target) ? target : [target];
    const archivedOnly = targets.every(p => p.status === 'archived');

    if (archivedOnly) {
      setConfirmDelete({ 
        projects: targets, 
        taskCount: targets.reduce((acc, p) => acc + (p.total_tasks || 0), 0) 
      });
    } else {
      if (confirm(`Archive ${targets.length > 1 ? targets.length + ' projects' : 'this project'}?`)) {
        for (const p of targets) {
          await deleteProject(p.id);
        }
        clearSelection();
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    for (const p of confirmDelete.projects) {
      await deleteProject(p.id);
    }
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
        {isMobile && (
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
        )}
      </div>

      {/* Unassigned Tasks Panel - Mobile only or hidden as requested */}
      {showUnassigned && isMobile && (
        <div className="glass-panel" style={{ marginBottom: '20px', padding: '16px 20px' }}>
          {/* ... (Unassigned tasks logic kept unchanged) ... */}
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
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={selectedProjectIds.size === visibleProjects.length && visibleProjects.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
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
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjectIds.has(project.id)}
                  onSelect={() => handleSelect(project.id, index)}
                  onClick={handleProjectClick}
                  updateProject={updateProject}
                  getAreaInfo={getAreaInfo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && visibleProjects.length > 0 && (
        <div className="projects-mobile-list">
          {visibleProjects.map(project => {
            const area = getAreaInfo(project.area);
            const total = project.total_tasks ?? 0;
            const done = project.complete_tasks ?? 0;
            const pct = calcProgression(done, total);
            
            return (
              <div key={project.id} className="project-mobile-card" onClick={() => handleProjectClick(project)}>
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
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(231, 76, 60, 0.08)',
                  border: '1px solid rgba(231, 76, 60, 0.2)',
                  color: 'var(--accent-danger)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
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

      {/* Project slide-out drawer */}
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
