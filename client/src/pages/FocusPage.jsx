import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { usePeople } from '../hooks/usePeople';
import { fetchAreas } from '../utils/api/areas';
import TaskDrawer from '../components/TaskDrawer';
import ProjectDrawer from '../components/ProjectDrawer';
import PomodoroPanel from '../components/PomodoroPanel';
import { getStatusInfo, PRIORITY_COLORS } from '../utils/statusMap';
import { calcDaysLeft, formatDaysLeft } from '../lib/taskMath';

function TaskRow({ task, projects, isSelected, onClick }) {
  const project = projects.find(p => p.id === task.project_id);
  const status = getStatusInfo(task.status);
  const daysLeft = calcDaysLeft(task.date_due);
  const priorityColor = PRIORITY_COLORS[task.priority] ?? 'var(--text-dimmed)';
  const overdue = task.date_due && daysLeft < 0;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: priorityColor, fontSize: '9px', flexShrink: 0 }}>●</span>
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {project && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </span>
      )}
      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: status.color ?? 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {status.label}
      </span>
      {task.date_due && (
        <span style={{ fontSize: '11px', color: overdue ? 'var(--danger, #e74c3c)' : 'var(--text-dimmed)', flexShrink: 0 }}>
          {formatDaysLeft(daysLeft)}
        </span>
      )}
    </div>
  );
}

function ProjectRow({ project, isSelected, onClick }) {
  const total = project.total_tasks ?? 0;
  const done = project.complete_tasks ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(52,152,219,0.08)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(52,152,219,0.25)' : 'transparent'}`,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {project.phase && (
        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(52,152,219,0.1)', color: 'var(--accent-primary)', flexShrink: 0 }}>
          {project.phase}
        </span>
      )}
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.title}
      </span>
      {total > 0 && (
        <div style={{ width: '56px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#2ecc71' : 'var(--accent-primary)', borderRadius: '2px' }} />
        </div>
      )}
      <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', flexShrink: 0, width: '28px', textAlign: 'right' }}>
        {total > 0 ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

function SectionLabel({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 6px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dimmed)' }}>
        {count}
      </span>
    </div>
  );
}

export default function FocusPage() {
  const { tasks, loading: tasksLoading, updateTask, deleteTask, refetch: refetchTasks } = useTasks();
  const { projects, loading: projectsLoading, updateProject, deleteProject, refetch: refetchProjects } = useProjects();
  const { people } = usePeople();
  const [areas, setAreas] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  const getAreaInfo = useCallback((areaId) => areas.find(a => a.id === areaId), [areas]);

  const starredTasks = useMemo(() => tasks.filter(t => t.is_starred), [tasks]);
  const starredProjects = useMemo(() => projects.filter(p => p.is_starred), [projects]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.filter(t => t.id === selectedTaskId) : []),
    [selectedTaskId, tasks]
  );
  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.filter(p => p.id === selectedProjectId) : []),
    [selectedProjectId, projects]
  );

  const handleDeleteTask = useCallback(async (id) => {
    await deleteTask(id);
    setSelectedTaskId(null);
  }, [deleteTask]);

  const handleDeleteProject = useCallback(async (id) => {
    await deleteProject(id);
    setSelectedProjectId(null);
  }, [deleteProject]);

  const handleAreasChanged = useCallback(async () => {
    const updated = await fetchAreas();
    setAreas(updated);
  }, []);

  const isEmpty = !tasksLoading && !projectsLoading && starredTasks.length === 0 && starredProjects.length === 0;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: starred lists */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Focus</h2>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Starred projects and tasks</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 8px' }}>
          {isEmpty && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-dimmed)' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>★</div>
              <p style={{ fontSize: '12px', margin: 0 }}>Star a project or task to pin it here.</p>
            </div>
          )}

          {(projectsLoading || starredProjects.length > 0) && (
            <div style={{ marginBottom: '20px' }}>
              <SectionLabel label="Projects" count={starredProjects.length} />
              {projectsLoading
                ? <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-dimmed)' }}>Loading…</div>
                : starredProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    isSelected={selectedProjectId === project.id}
                    onClick={() => {
                      setSelectedTaskId(null);
                      setSelectedProjectId(prev => prev === project.id ? null : project.id);
                    }}
                  />
                ))
              }
            </div>
          )}

          {(tasksLoading || starredTasks.length > 0) && (
            <div>
              <SectionLabel label="Tasks" count={starredTasks.length} />
              {tasksLoading
                ? <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-dimmed)' }}>Loading…</div>
                : starredTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => {
                      setSelectedProjectId(null);
                      setSelectedTaskId(prev => prev === task.id ? null : task.id);
                    }}
                  />
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Right: Pomodoro */}
      <div style={{ width: '340px', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <PomodoroPanel
          timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          isMobileView={true}
        />
      </div>

      {selectedTask.length > 0 && (
        <TaskDrawer
          tasks={selectedTask}
          projects={projects}
          areas={areas}
          onSave={async (id, data) => { await updateTask(id, data); refetchTasks(); }}
          onDelete={handleDeleteTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {selectedProject.length > 0 && (
        <ProjectDrawer
          projects={selectedProject}
          onSave={async (id, data) => { await updateProject(id, data); refetchProjects(); }}
          onDelete={handleDeleteProject}
          onClose={() => setSelectedProjectId(null)}
          onAreasChanged={handleAreasChanged}
        />
      )}
    </div>
  );
}
