import React, { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import KanbanCard from './KanbanCard';

const COLUMNS = [
  { id: 'next', label: 'Next Steps', status: '02 - Next Step', color: 'var(--accent-primary)' },
  { id: 'progress', label: 'In Progress', status: '03 - In Progress', color: 'var(--accent-warning)' },
  { id: 'waiting', label: 'Waiting', status: '04 - Waiting for Someone', color: 'var(--text-secondary)' },
  { id: 'done', label: 'Completed', status: '07 - Done', color: 'var(--accent-success)' },
];

export default function KanbanBoard() {
  const { tasks, loading, updateTask, refetch } = useTasks();
  const { projects } = useProjects();
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const getTasksForStatus = (status) => {
    return tasks.filter(t => t.status === status);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('task-id');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      await updateTask(taskId, { status: targetStatus });
    }
  };

  if (loading && tasks.length === 0) return <div className="skeleton-row" style={{ height: '400px' }} />;

  return (
    <div className="kanban-board" style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 200px)', overflowX: 'auto', paddingBottom: '20px' }}>
      {COLUMNS.map(col => (
        <div
          key={col.id}
          className={`kanban-column ${dragOverColumn === col.id ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, col.id)}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={(e) => handleDrop(e, col.status)}
          style={{
            flex: '1',
            minWidth: '280px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            border: dragOverColumn === col.id ? `1px dashed ${col.color}` : '1px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: `2px solid ${col.color}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</h3>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{getTasksForStatus(col.status).length}</span>
          </div>

          <div style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
            {getTasksForStatus(col.status).map(task => (
              <KanbanCard 
                key={task.id} 
                task={task} 
                project={projects.find(p => p.id === task.project_id)} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
