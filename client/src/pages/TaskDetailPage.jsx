import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas } from '../utils/api';
import { GTD_STATUSES, getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, updateTask, deleteTask, loading: tasksLoading } = useTasks();
  const { projects } = useProjects();
  const [areas, setAreas] = useState([]);
  const [task, setTask] = useState(null);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      const found = tasks.find(t => t.id.toString() === id);
      if (found) setTask(found);
    }
  }, [tasks, id]);

  const handleUpdate = async (fields) => {
    await updateTask(task.id, fields);
    setTask(prev => ({ ...prev, ...fields }));
  };

  if (tasksLoading && !task) return <div className="page-container"><div className="skeleton-row" style={{ height: '400px' }} /></div>;
  if (!task) return <div className="page-container">Task not found.</div>;

  return (
    <div className="page-container task-detail-page">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/tasks" className="btn btn-ghost" style={{ padding: '8px' }} title="Back to Tasks">
             ← Back
          </Link>
          <h2 style={{ margin: 0 }}>Task Details</h2>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            className="form-input"
            style={{ fontSize: '1.2rem', fontWeight: 600 }}
            value={task.title}
            onChange={(e) => handleUpdate({ title: e.target.value })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={task.status}
              onChange={(e) => handleUpdate({ status: e.target.value })}
            >
              {GTD_STATUSES.map(s => (
                <option key={s} value={s}>{getStatusInfo(s).label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {[0, 1, 2, 3].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleUpdate({ priority: p })}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: task.priority === p ? 'var(--text-primary)' : 'transparent',
                    background: p === 0 ? 'var(--bg-card)' : PRIORITY_COLORS[p],
                    cursor: 'pointer'
                  }}
                  title={`Priority ${p}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label">Project</label>
            <select
              className="form-select"
              value={task.project_id || ''}
              onChange={(e) => handleUpdate({ project_id: e.target.value || null })}
            >
              <option value="">No Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              className="form-input"
              value={task.date_due || ''}
              onChange={(e) => handleUpdate({ date_due: e.target.value || null })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label">ECT (minutes)</label>
            <input
              type="number"
              className="form-input"
              value={task.estimated_minutes || 0}
              onChange={(e) => handleUpdate({ estimated_minutes: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Received Date</label>
            <div className="form-input" style={{ opacity: 0.7, background: 'transparent', border: 'none', paddingLeft: 0 }}>
              {new Date(task.received_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            style={{ minHeight: '150px', resize: 'vertical' }}
            value={task.notes || ''}
            onChange={(e) => handleUpdate({ notes: e.target.value })}
            placeholder="Add task descriptions, links, or notes..."
          />
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (confirm('Delete this task?')) {
                await deleteTask(task.id);
                navigate('/tasks');
              }
            }}
          >
            Delete Task
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/tasks')}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
