import React from 'react';
import { PRIORITY_COLORS } from '../utils/statusMap';

export default function KanbanCard({ task, project, onDragStart }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('task-id', task.id);
    e.dataTransfer.setData('task-title', task.title);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e, task);
  };

  return (
    <div
      className="kanban-card glass-panel"
      draggable
      onDragStart={handleDragStart}
      style={{
        padding: '12px',
        marginBottom: '12px',
        cursor: 'grab',
        borderLeft: `4px solid ${PRIORITY_COLORS[task.priority] || '#444'}`,
        position: 'relative'
      }}
    >
      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '8px' }}>
        {task.title}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
        {project ? (
          <span className="cell-project-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
            {project.title}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>No Project</span>
        )}
        
        {task.date_due && (
          <span style={{ color: 'var(--accent-warning)' }}>
            {new Date(task.date_due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}
