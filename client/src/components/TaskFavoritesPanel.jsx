import { useState, useMemo } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { updateTask } from '../utils/api/tasks';
import './TaskFavoritesPanel.css';

const TaskFavoritesPanel = () => {
  const [query, setQuery] = useState('');
  const { tasks, refetch } = useTasks();
  const { projects } = useProjects();

  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach(p => { m[p.id] = p.title; });
    return m;
  }, [projects]);

  const starredTasks = useMemo(() => tasks.filter(t => t.is_starred), [tasks]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks
      .filter(t => !t.is_starred && t.title?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [tasks, query]);

  const handleToggleStar = async (task) => {
    await updateTask(task.id, { is_starred: task.is_starred ? 0 : 1 });
    refetch();
  };

  const TaskRow = ({ task }) => (
    <div className="tfp-task-row">
      <button
        type="button"
        className={`tfp-star-btn${task.is_starred ? ' starred' : ''}`}
        onClick={() => handleToggleStar(task)}
        title={task.is_starred ? 'Remove from favorites' : 'Add to favorites'}
      >
        {task.is_starred ? '★' : '☆'}
      </button>
      <div className="tfp-task-info">
        <span className="tfp-task-title">{task.title}</span>
        {projectMap[task.project_id] && (
          <span className="tfp-task-project">{projectMap[task.project_id]}</span>
        )}
      </div>
    </div>
  );

  const showSearch = query.trim().length > 0;

  return (
    <div className="task-favorites-panel">
      <div className="tfp-search-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="tfp-search-icon">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          className="tfp-search-input"
          type="text"
          placeholder="Search tasks to favorite…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="tfp-clear-btn" onClick={() => setQuery('')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      <div className="tfp-list">
        {showSearch ? (
          searchResults.length > 0 ? (
            searchResults.map(task => <TaskRow key={task.id} task={task} />)
          ) : (
            <p className="tfp-empty">No tasks found</p>
          )
        ) : (
          starredTasks.length > 0 ? (
            starredTasks.map(task => <TaskRow key={task.id} task={task} />)
          ) : (
            <p className="tfp-empty">Search a task above to add favorites</p>
          )
        )}
      </div>
    </div>
  );
};

export default TaskFavoritesPanel;
