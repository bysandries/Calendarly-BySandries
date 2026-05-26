import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';
import { formatDuration, calcDaysLeft, formatDaysLeft, calcUrgency } from '../lib/taskMath';

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
  isSelected,
  onClick,
  onUpdateTask,
  onSelectionToggle,
  projects = [],
  people = [],
  areas,
}) {
  const getProjectTitle = (projectId) => {
    if (!projects) return null;
    const p = projects.find((pr) => pr.id === projectId);
    return p ? p.title : null;
  };

  const getProjectArea = (projectId) => {
    if (!projects) return null;
    const p = projects.find((pr) => pr.id === projectId);
    if (!p) return null;
    const area = areas.find((a) => a.id === p.area);
    return area || null;
  };

  const statusInfo = getStatusInfo(task.status);
  const projectTitle = getProjectTitle(task.project_id);
  const projectArea = getProjectArea(task.project_id);
  const daysLeft = calcDaysLeft(task.date_due);
  const urgency = calcUrgency(daysLeft, task.estimated_minutes);

  const stopPropagation = (e) => e.stopPropagation();

  const renderCell = (col) => {
    if (!visibleColumns[col]) return null;

    const desktopOnly = col !== 'title';
    const cellClass = desktopOnly ? "desktop-only-cell" : "";

    switch (col) {
      case 'assignee':
        const person = people.find(p => p.id === task.person_id);
        return (
          <td key={col} className={cellClass}>
            <span style={{ fontSize: '0.85rem', color: person ? 'var(--text-primary)' : 'var(--text-dimmed)' }}>
              {person ? person.name : 'Unassigned'}
            </span>
          </td>
        );
      case 'starred':
        return (
          <td key={col} className={cellClass} onClick={(e) => {
            stopPropagation(e);
            onUpdateTask(task.id, { is_starred: task.is_starred ? 0 : 1 });
          }}>
            <span style={{ fontSize: '1.2rem', cursor: 'pointer', color: task.is_starred ? '#F1C40F' : 'var(--text-muted)' }}>
              {task.is_starred ? '★' : '☆'}
            </span>
          </td>
        );
      case 'urgency':
        return (
          <td key={col} className={cellClass}>
            <span className={`urgency-badge ${urgency.cssClass}`}>
              {urgency.label}
            </span>
          </td>
        );
      case 'status':
        return (
          <td key={col} className={cellClass}>
            <span className={`status-badge-inline ${statusInfo.cssClass}`}>
              {statusInfo.label}
            </span>
          </td>
        );
      case 'priority':
        return (
          <td key={col} className={cellClass}>
            <div className="priority-dots">
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
          <td key={col} className={cellClass} style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            <div style={{ display: 'block', fontWeight: 500 }}>
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
              <span className="text-dimmed">—</span>
            )}
          </td>
        );
      case 'ect':
        return (
          <td key={col} className={cellClass}>
            <span className="ect-cell">
              {formatDuration(task.estimated_minutes)}
            </span>
          </td>
        );
      case 'date_due':
        return (
          <td key={col} className={cellClass}>
            <span className={isOverdue(task.date_due) ? 'overdue' : ''}>
              {formatDate(task.date_due)}
            </span>
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
            {/* Removed inline delete for cleaner multi-select UI */}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <tr
      onClick={(e) => onClick(e)}
      className={`task-row ${isSelected ? 'selected' : ''}`}
      style={{ cursor: 'pointer' }}
    >
      {onSelectionToggle && (
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="task-checkbox"
            checked={!!isSelected}
            onChange={() => onSelectionToggle(task.id)}
          />
        </td>
      )}
      {columnOrder.map((col) => renderCell(col))}
    </tr>
  );
}
