import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas } from '../utils/api';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';
import { getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';
import { calcDaysLeft, calcUrgency } from '../lib/taskMath';

export default function PersonDetailPage() {
  const { id } = useParams();
  const { people, loading: loadingPeople } = usePeople();
  const { tasks, loading: loadingTasks, updateTask, deleteTask, refetch: refetchTasks } = useTasks({ person_id: id });
  const { projects, loading: loadingProjects, refetch: refetchProjects } = useProjects({ person_id: id });
  const [areas, setAreas] = useState([]);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  const person = people.find(p => p.id === id);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    refetchTasks({ person_id: id });
    refetchProjects({ person_id: id });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTaskClick = (e, taskId, index) => {
    const isShift = e.shiftKey;
    const isCmdCtrl = e.metaKey || e.ctrlKey;

    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeSet = new Set(prev);
        tasks.slice(start, end + 1).forEach(t => rangeSet.add(t.id));
        return rangeSet;
      } else if (isCmdCtrl) {
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
      } else {
        return new Set([taskId]);
      }
      return next;
    });
    setLastSelectedIndex(index);
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
    setLastSelectedIndex(null);
  };

  const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));

  if (loadingPeople || !person) {
    return <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  return (
    <div className="person-detail-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="person-avatar-large" style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'var(--accent-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'white'
          }}>
            {person.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{person.name}</h2>
            <p className="text-dimmed" style={{ margin: '4px 0 0' }}>Team Member Dashboard</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginTop: '32px' }}>
        
        {/* Left Column: Projects */}
        <section>
          <h3 style={{ marginBottom: '16px' }}>Assigned Projects</h3>
          {loadingProjects ? (
            <div className="skeleton" style={{ height: '100px' }} />
          ) : projects.length === 0 ? (
            <div className="glass-panel" style={{ padding: '20px', color: 'var(--text-muted)' }}>
              No projects assigned.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {projects.map(p => {
                const area = areas.find(a => a.id === p.area);
                return (
                  <Link 
                    key={p.id} 
                    to={`/projects/${p.id}`} 
                    className="glass-panel project-mini-card"
                    style={{ 
                      padding: '16px', 
                      textDecoration: 'none', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <div style={{ 
                      width: '8px', 
                      height: '32px', 
                      borderRadius: '4px', 
                      background: area?.color_hex || 'var(--text-dimmed)' 
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>{p.status.toUpperCase()} • {p.phase}</div>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--text-dimmed)' }}>›</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Tasks */}
        <section>
          <h3 style={{ marginBottom: '16px' }}>Assigned Tasks</h3>
          {loadingTasks ? (
            <div className="skeleton" style={{ height: '300px' }} />
          ) : tasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '20px', color: 'var(--text-muted)' }}>
              No tasks assigned.
            </div>
          ) : (
            <div className="glass-panel data-table-wrapper">
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th>Title</th>
                    <th style={{ width: '130px' }}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      viewMode="desktop"
                      visibleColumns={{ status: true, title: true, date_due: true, starred: true }}
                      columnOrder={['starred', 'status', 'title', 'date_due']}
                      isSelected={selectedTaskIds.has(task.id)}
                      onClick={(e) => handleTaskClick(e, task.id, index)}
                      onUpdateTask={updateTask}
                      projects={[]} // Handled by project detail links
                      areas={areas}
                      people={people}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <TaskDrawer
        tasks={selectedTasks}
        projects={[]} 
        areas={areas}
        onSave={updateTask}
        onDelete={deleteTask}
        onClose={clearSelection}
      />
    </div>
  );
}
