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
  visibleColumns = {},
  columnOrder = [],
  isSelected,
  onClick,
  onCheckboxToggle,
  updateProject,
  people = [],
  getAreaInfo,
}) {
  const area = getAreaInfo(project.area);
  const total = project.total_tasks ?? 0;
  const done = project.complete_tasks ?? 0;
  const pct = calcProgression(done, total);
  const importance = calcImportance(total);

  const stopPropagation = (e) => e.stopPropagation();

  const renderCell = (col) => {
    if (!visibleColumns[col]) return null;
    const desktopOnly = !['title', 'assignee', 'due_date'].includes(col);
    const cellClass = desktopOnly ? 'desktop-only-cell' : '';

    switch (col) {
      case 'starred':
        return (
          <td key={col} className={cellClass} onClick={(e) => {
            stopPropagation(e);
            updateProject(project.id, { is_starred: project.is_starred ? 0 : 1 });
          }}>
            <span style={{ fontSize: '1.2rem', cursor: 'pointer', color: project.is_starred ? '#F1C40F' : 'var(--text-muted)' }}>
              {project.is_starred ? '★' : '☆'}
            </span>
          </td>
        );

      case 'status':
        return (
          <td key={col} className={cellClass} onClick={stopPropagation}>
            <ProjectStatusBadge
              status={project.status}
              onChange={(s) => updateProject(project.id, { status: s })}
            />
          </td>
        );

      case 'title': {
        const assignedPerson = people.find(p => p.id === project.person_id);
        return (
          <td key={col} className={cellClass}>
            <div style={{ position: 'relative', paddingLeft: '12px' }}>
              <div className="area-strip" style={{ background: area?.color_hex || '#95A5A6' }} />
              <Link
                to={`/projects/${project.id}`}
                className="project-title-link"
                style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                onClick={stopPropagation}
              >
                {project.title}
              </Link>
              {project.description && (
                <div className="desktop-only-cell" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {project.description.substring(0, 70)}{project.description.length > 70 ? '…' : ''}
                </div>
              )}
              <div className="mobile-only-subtext">
                {assignedPerson && (
                  <span className="mobile-project-tag">{assignedPerson.name}</span>
                )}
                {project.due_date && (
                  <span className="mobile-date-tag">{formatIsoDateShort(project.due_date)}</span>
                )}
              </div>
            </div>
          </td>
        );
      }

      case 'phase':
        return (
          <td key={col} className={cellClass}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
            }}>
              {project.phase || '—'}
            </span>
          </td>
        );

      case 'pillar':
        return (
          <td key={col} className={cellClass}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {project.pillar || '—'}
            </span>
          </td>
        );

      case 'area':
        return (
          <td key={col} className={cellClass}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className="color-swatch"
                style={{ background: area?.color_hex || '#95A5A6', width: '10px', height: '10px' }}
              />
              <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>
                {project.area || '—'}
              </span>
            </span>
          </td>
        );

      case 'assignee': {
        const person = people.find(p => p.id === project.person_id);
        return (
          <td key={col} className={cellClass}>
            <span style={{ fontSize: '0.8rem', color: person ? 'var(--text-primary)' : 'var(--text-dimmed)' }}>
              {person ? person.name : '—'}
            </span>
          </td>
        );
      }

      case 'due_date':
        return (
          <td key={col} className={cellClass}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {formatIsoDateShort(project.due_date)}
            </span>
          </td>
        );

      case 'start_date':
        return (
          <td key={col} className={cellClass}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {formatIsoDateShort(project.start_date)}
            </span>
          </td>
        );

      case 'progression':
        return (
          <td key={col} className={cellClass}>
            {pct === null ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>—</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '60px', height: '6px',
                  background: 'rgba(255,255,255,0.1)', borderRadius: '3px', flexShrink: 0,
                }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: pct === 100 ? '#2ECC71' : 'var(--accent-primary)',
                    borderRadius: '3px', transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '30px' }}>
                  {pct}%
                </span>
              </div>
            )}
          </td>
        );

      case 'time_invested':
        return (
          <td key={col} className={cellClass}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600,
              color: (project.pomodoro_minutes ?? 0) > 0 ? 'var(--accent-primary)' : 'var(--text-dimmed)',
            }}>
              {formatDuration(project.pomodoro_minutes ?? 0)}
            </span>
          </td>
        );

      case 'importance':
        return (
          <td key={col} className={cellClass}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600,
              color: IMPORTANCE_COLORS[importance.cssClass],
            }}>
              {importance.label}
            </span>
          </td>
        );

      case 'notes':
        return (
          <td key={col} className={cellClass}>
            {project.description && (
              <span className="notes-indicator" title={project.description}>📝</span>
            )}
          </td>
        );

      default:
        return null;
    }
  };

  return (
    <tr
      className={`project-row ${isSelected ? 'selected' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      {/* Always-visible checkbox — separate from row click */}
      <td
        style={{ width: '40px', textAlign: 'center' }}
        className="desktop-only-cell"
        onClick={stopPropagation}
      >
        <input
          type="checkbox"
          className="task-checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={onCheckboxToggle}
        />
      </td>
      {columnOrder.map(col => renderCell(col))}
    </tr>
  );
}
