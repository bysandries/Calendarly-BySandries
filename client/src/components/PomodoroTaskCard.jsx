import { useState } from 'react';
import { updateTask } from '../utils/api';

export default function PomodoroTaskCard({
  task,
  isSelected,
  areaColor,
  onSelect,
  onTaskUpdate,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showProjectConfirm, setShowProjectConfirm] = useState(false);

  const handleCheck = () => {
    if (task.project_id) {
      // Has project, mark done directly
      markDone();
    } else {
      // No project, ask
      setShowProjectConfirm(true);
    }
  };

  const markDone = async (projectId = task.project_id) => {
    try {
      const updated = await updateTask(task.id, {
        status: '07 - Done',
        project_id: projectId,
      });
      if (onTaskUpdate) onTaskUpdate(updated);
    } catch (err) {
      console.error('Failed to mark task done:', err);
    }
    setShowProjectConfirm(false);
  };

  const handleTitleBlur = async () => {
    setIsEditing(false);
    if (editTitle && editTitle !== task.title) {
      try {
        const updated = await updateTask(task.id, { title: editTitle });
        if (onTaskUpdate) onTaskUpdate(updated);
      } catch (err) {
        console.error('Failed to update task title:', err);
        setEditTitle(task.title);
      }
    } else {
      setEditTitle(task.title);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(task.title);
    }
  };

  return (
    <div
      className={`pomodoro-task-card ${isSelected ? 'selected' : ''}`}
      style={isSelected ? { borderColor: areaColor, boxShadow: `0 0 16px ${areaColor}33` } : {}}
    >
      <button
        type="button"
        className="pomodoro-task-check"
        onClick={(e) => { e.stopPropagation(); handleCheck(); }}
        title="Mark as done"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>

      {isEditing ? (
        <input
          className="pomodoro-task-title-input"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="pomodoro-task-title"
          onClick={() => onSelect(task)}
        >
          {task.title}
        </span>
      )}

      <button
        type="button"
        className="pomodoro-task-edit"
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        title="Edit title"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {showProjectConfirm && (
        <div className="pomodoro-project-confirm glass-panel">
          <p>Does this task belong to a project?</p>
          <div className="pomodoro-project-confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => markDone(null)}>
              No project
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowProjectConfirm(false)}>
              Assign project first
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
