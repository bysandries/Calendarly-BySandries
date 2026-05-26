import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import ProjectPicker from './ProjectPicker';
import { getStatusInfo, GTD_STATUSES, PRIORITY_COLORS, getNextPriority } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency, formatIsoDateShort } from '../lib/taskMath';

const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function TaskCard({
  task,
  viewMode = 'desktop',
  visibleColumns = {},
  columnOrder = [],
  columnWidths = {},
  isSelected,
  onToggleSelect,
  onUpdateTask,
  onDeleteTask,
  projects,
  areas,
  createProject,
}) {
  const navigate = useNavigate();
  const [editingEct, setEditingEct] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);

  const getProjectTitle = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p ? p.title : null;
  };

  const getProjectArea = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    if (!p) return null;
    const area = areas.find((a) => a.id === p.area);
    return area || null;
  };

  const handleRowClick = () => {
    navigate(`/tasks/${task.id}`);
  };

  const stopPropagation = (e) => e.stopPropagation();

  const handlePriorityCycle = async (e) => {
    e.stopPropagation();
    const next = getNextPriority(task.priority);
    await onUpdateTask(task.id, { priority: next });
  };

  const handleEctBlur = async (raw) => {
    setEditingEct(false);
    const minutes = parseInt(raw, 10);
    const next = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
    if (next !== (task.estimated_minutes || 0)) {
      await onUpdateTask(task.id, { estimated_minutes: next });
    }
  };

  const handleDueDateChange = async (value) => {
    setEditingDueDate(false);
    const next = value || null;
    if (next !== (task.date_due || null)) {
      await onUpdateTask(task.id, { date_due: next });
    }
  };

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

  if (viewMode === 'mobile') {
    // We are removing the explicit 'mobile' viewMode usage in TasksPage, 
    // but keeping a simplified version here just in case of other usages.
    return (
      <Link
        to={`/tasks/${task.id}`}
        className="task-mobile-card"
      >
        <div className="task-mobile-info">
          <span className="task-mobile-title">{task.title}</span>
          <span className="task-mobile-date">
            {task.date_due ? `Due: ${formatDate(task.date_due)}` : 'No due date'}
          </span>
        </div>
        <div className="task-mobile-arrow">›</div>
      </Link>
    );
  }

  const renderCell = (col) => {
    if (!visibleColumns[col]) return null;

    // User wants ONLY task name and due date on mobile.
    // Due date is in the subtext of the 'title' cell.
    // So all other columns (urgency, status, priority, project, ect, date_due, days_left, notes, actions) are desktop-only.
    const desktopOnly = col !== 'title';
    const cellClass = desktopOnly ? "desktop-only-cell" : "";

    switch (col) {
      case 'urgency':
        return (
          <td key={col} className={cellClass}>
            <span className={`urgency-badge ${urgency.cssClass}`} title={urgencyTitle}>
              {urgency.label}
            </span>
          </td>
        );
      case 'status':
        return (
          <td key={col} className={cellClass}>
            <select
              className={`status-select ${statusInfo.cssClass}`}
              value={task.status || '01 - Inbox'}
              onChange={(e) => {
                stopPropagation(e);
                onUpdateTask(task.id, { status: e.target.value });
              }}
              onClick={stopPropagation}
              title="Change status"
            >
              {GTD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {getStatusInfo(s).label}
                </option>
              ))}
            </select>
          </td>
        );
      case 'priority':
        return (
          <td key={col} className={cellClass}>
            <div
              className="priority-dots"
              onClick={handlePriorityCycle}
              title={`Priority: ${task.priority}/3 — Click to cycle`}
            >
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`priority-dot ${level <= task.priority ? 'filled' : ''}`}
                  style={level <= task.priority ? { background: PRIORITY_COLORS[task.priority] } : {}}
                />
              ))}
            </div>
          </td>
        );
      case 'title':
        return (
          <td key={col} className={cellClass}>
            <div
              className="cell-truncate project-title-link"
              style={{ display: 'block', fontWeight: 500 }}
              title="View details"
            >
              {task.title}
              <div className="mobile-only-subtext">
                {projectTitle && <span className="mobile-project-tag">{projectTitle}</span>}
                {task.date_due && <span className="mobile-date-tag">{formatDate(task.date_due)}</span>}
              </div>
            </div>
          </td>
        );
      case 'project':
        return (
          <td key={col} className={cellClass}>
            <div onClick={stopPropagation}>
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
                  onSelect={(projectId) => onUpdateTask(task.id, { project_id: projectId })}
                  onCreate={async (title) => {
                    const p = await createProject({
                      title,
                      status: 'active',
                      area: 'general',
                      pillar: 'Innovation',
                      phase: 'Plan',
                      methodology: 'PALM',
                    });
                    await onUpdateTask(task.id, { project_id: p.id });
                  }}
                />
              )}
            </div>
          </td>
        );
      case 'ect':
        return (
          <td key={col} className={cellClass}>
            <div onClick={stopPropagation}>
              {editingEct ? (
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="inline-edit-compact"
                  defaultValue={task.estimated_minutes || ''}
                  autoFocus
                  onBlur={(e) => handleEctBlur(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    else if (e.key === 'Escape') setEditingEct(false);
                  }}
                />
              ) : (
                <span
                  className="ect-cell"
                  onClick={() => setEditingEct(true)}
                  title="Click to edit estimated completion time (minutes)"
                >
                  {formatDuration(task.estimated_minutes)}
                </span>
              )}
            </div>
          </td>
        );
      case 'date_due':
        return (
          <td key={col} className={cellClass}>
            <div onClick={stopPropagation}>
              {editingDueDate ? (
                <input
                  type="date"
                  className="inline-edit-compact"
                  defaultValue={task.date_due || ''}
                  autoFocus
                  onBlur={(e) => handleDueDateChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    else if (e.key === 'Escape') setEditingDueDate(false);
                  }}
                />
              ) : (
                <span
                  className={isOverdue(task.date_due) ? 'overdue' : ''}
                  onClick={() => setEditingDueDate(true)}
                  style={{ cursor: 'pointer' }}
                  title="Click to edit due date"
                >
                  {formatDate(task.date_due)}
                </span>
              )}
            </div>
          </td>
        );
      case 'days_left':
        return (
          <td key={col} className={cellClass}>
            <span className={`days-left-cell ${daysLeft !== null && daysLeft < 0 ? 'overdue' : ''}`}>
              {formatDaysLeft(daysLeft)}
            </span>
          </td>
        );
      case 'notes':
        return (
          <td key={col} className={cellClass}>
            {task.notes && (
              <span className="notes-indicator" title={task.notes}>📝</span>
            )}
          </td>
        );
      case 'actions':
        return (
          <td key={col} className={cellClass}>
            <button
              className="btn-icon"
              onClick={(e) => {
                stopPropagation(e);
                if (confirm('Delete this task?')) onDeleteTask(task.id);
              }}
              title="Delete task"
            >
              ✕
            </button>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <tr onClick={handleRowClick} style={{ cursor: 'pointer' }} className="task-row">
      <td className="mobile-hide-col">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={isSelected}
          onChange={(e) => {
            stopPropagation(e);
            onToggleSelect(task.id);
          }}
          onClick={stopPropagation}
        />
      </td>
      {columnOrder.map((col) => renderCell(col))}
    </tr>
  );
}
