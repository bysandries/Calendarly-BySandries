import React from 'react';
import KanbanBoard from '../components/KanbanBoard';

export default function KanbanPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Kanban Board</h2>
        <p className="page-description">Visualize your workflow and progress across all projects.</p>
      </div>
      <KanbanBoard />
    </div>
  );
}
