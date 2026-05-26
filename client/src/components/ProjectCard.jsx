import { Link } from 'react-router-dom';
import ProjectStatusBadge from './ProjectStatusBadge';
import { formatIsoDateShort, calcProgression, calcImportance, formatDuration } from '../lib/taskMath';

const IMPORTANCE_COLORS = {
  'importance-none':     'var(--text-dimmed)',
  'importance-low':      '#3498DB',
  'importance-medium':   '#E67E22',
  'importance-high':     '#E74C3C',
  'importance-critical': '#8E44AD',
};

export default function ProjectCard({
  project,
  isSelected,
  onSelect,
  onClick,
  updateProject,
  getAreaInfo,
}) {
  const area = getAreaInfo(project.area);
  const total = project.total_tasks ?? 0;
  const done = project.complete_tasks ?? 0;
  const pct = calcProgression(done, total);
  const importance = calcImportance(total);

  return (
    <tr
      className={`project-row ${isSelected ? 'selected' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(project)}
    >
      {/* Checkbox */}
      <td onClick={(e) => e.stopPropagation()} style={{ width: '40px', textAlign: 'center' }}>
        <input
          type="checkbox"
          className="task-checkbox"
          checked={isSelected}
          onChange={() => onSelect(project.id)}
        />
      </td>

      {/* Status */}
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
          <span className="color-swatch" style={{ background: area?.color_hex || '#95A5A6', width: '12px', height: '12px' }} />
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
          onClick={() => onClick(project)}
          title="Edit project"
        >
          ✎
        </button>
      </td>
    </tr>
  );
}
