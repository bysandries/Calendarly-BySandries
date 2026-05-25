import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas } from '../utils/api';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import {
  formatDuration,
  formatIsoDateShort,
  calcProgression,
  calcImportance,
} from '../lib/taskMath';

const PALM_PHASES = ['Plan', 'Act', 'Measure', 'Learn'];
const PILLARS = ['Kindness', 'Authenticity', 'Resilience', 'Innovation'];
const PROJECT_STATUSES = ['active', 'on-hold', 'completed'];
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
  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();
  const [areas, setAreas] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '', status: 'active', area: 'general', pillar: 'Innovation',
    phase: 'Plan', goals_aligned: [], description: '', methodology: 'PALM',
    person_in_charge: '', due_date: '', start_date: '', end_date: '',
  });
  const [goalsInput, setGoalsInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  const getAreaInfo = (areaId) => areas.find(a => a.id === areaId);

  const handleDeleteClick = (project) => {
    if (project.status === 'archived') {
      setConfirmDelete({ project, taskCount: project.total_tasks });
    } else {
      deleteProject(project.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await deleteProject(confirmDelete.project.id);
    setConfirmDelete(null);
  };

  const openCreateForm = () => {
    setEditingProject(null);
    setFormData({
      title: '', status: 'active', area: 'general', pillar: 'Innovation',
      phase: 'Plan', goals_aligned: [], description: '', methodology: 'PALM',
      person_in_charge: '', due_date: '', start_date: '', end_date: '',
    });
    setGoalsInput('');
    setShowForm(true);
  };

  const openEditForm = (project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      status: project.status,
      area: project.area,
      pillar: project.pillar,
      phase: project.phase,
      goals_aligned: project.goals_aligned || [],
      description: project.description || '',
      methodology: project.methodology || 'PALM',
      person_in_charge: project.person_in_charge || '',
      due_date: project.due_date || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setGoalsInput((project.goals_aligned || []).join(', '));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const goals = goalsInput.split(',').map(s => s.trim()).filter(Boolean);
    const data = { ...formData, goals_aligned: goals };
    if (editingProject) {
      await updateProject(editingProject.id, data);
    } else {
      await createProject(data);
    }
    setShowForm(false);
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
      </div>

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
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Status</th>
                <th>Title</th>
                <th style={{ width: '100px' }}>Area</th>
                <th style={{ width: '110px' }}>Pillar</th>
                <th style={{ width: '220px' }}>PALM Phase</th>
                <th style={{ width: '120px' }}>Persons</th>
                <th style={{ width: '95px' }}>Start Date</th>
                <th style={{ width: '95px' }}>End Date</th>
                <th style={{ width: '95px' }}>Due Date</th>
                <th style={{ width: '52px' }}>Tasks</th>
                <th style={{ width: '52px' }}>Done</th>
                <th style={{ width: '130px' }}>Progression</th>
                <th style={{ width: '80px' }}>Importance</th>
                <th style={{ width: '75px' }}>Est. Time</th>
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
                const remainingMins = project.remaining_estimated_minutes ?? 0;

                return (
                  <tr key={project.id}>
                    <td>
                      <ProjectStatusBadge
                        status={project.status}
                        onChange={(newStatus) => updateProject(project.id, { status: newStatus })}
                      />
                    </td>
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
                        >
                          {project.title}
                        </Link>
                        {project.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {project.description.substring(0, 80)}{project.description.length > 80 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="color-swatch" style={{ background: area?.color_hex || '#95A5A6' }} />
                        <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{project.area}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {project.pillar}
                      </span>
                    </td>
                    <td>
                      <div className="palm-phases">
                        {PALM_PHASES.map(phase => (
                          <span
                            key={phase}
                            className={`palm-phase ${project.phase === phase ? 'active' : ''}`}
                          >
                            {phase}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: project.person_in_charge ? 'var(--text-primary)' : 'var(--text-dimmed)' }}>
                        {project.person_in_charge || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatIsoDateShort(project.start_date)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatIsoDateShort(project.end_date)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatIsoDateShort(project.due_date)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: total > 0 ? 'var(--text-primary)' : 'var(--text-dimmed)' }}>
                        {total}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: done > 0 ? '#2ECC71' : 'var(--text-dimmed)' }}>
                        {done}
                      </span>
                    </td>
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
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: IMPORTANCE_COLORS[importance.cssClass] }}>
                        {importance.label}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: remainingMins > 0 ? 'var(--text-secondary)' : 'var(--text-dimmed)' }}>
                        {remainingMins > 0 ? formatDuration(remainingMins) : '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => openEditForm(project)}
                        title="Edit project"
                      >
                        ✎
                      </button>
                    </td>
                    <td>
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

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProject ? 'Edit Project' : 'Create Project'}</h3>
              <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Project name"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    {PROJECT_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Area</label>
                  <select
                    className="form-select"
                    value={formData.area}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Pillar</label>
                  <select
                    className="form-select"
                    value={formData.pillar}
                    onChange={(e) => setFormData(prev => ({ ...prev, pillar: e.target.value }))}
                  >
                    {PILLARS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">PALM Phase</label>
                  <select
                    className="form-select"
                    value={formData.phase}
                    onChange={(e) => setFormData(prev => ({ ...prev, phase: e.target.value }))}
                  >
                    {PALM_PHASES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Persons (responsible)</label>
                <input
                  className="form-input"
                  value={formData.person_in_charge}
                  onChange={(e) => setFormData(prev => ({ ...prev, person_in_charge: e.target.value }))}
                  placeholder="Who is in charge?"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Goals Aligned (comma-separated)</label>
                <input
                  className="form-input"
                  value={goalsInput}
                  onChange={(e) => setGoalsInput(e.target.value)}
                  placeholder="Build MVP, Ship v1, Learn React"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Project description..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingProject ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
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

      {/* FAB */}
      <button className="fab" onClick={openCreateForm} title="Create new project">
        +
      </button>
    </div>
  );
}
