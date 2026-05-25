import { useState, useEffect, useMemo } from 'react';
import './PomodoroPanel.css';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas } from '../utils/api';
import { updateTask } from '../utils/api';
import { usePomodoro } from '../hooks/usePomodoro';
import PomodoroTimer from './PomodoroTimer';
import TaskSearchPopover from './TaskSearchPopover';
import PomodoroTaskCard from './PomodoroTaskCard';

const ACTIONABLE_STATUSES = [
  '01 - Inbox',
  '02 - Next Step',
  '03 - In Progress',
  '04 - Waiting for Someone',
  '04 - Delegate It',
];

export default function PomodoroPanel({ timezone }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [areas, setAreas] = useState([]);
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();
  const { projects } = useProjects();

  const pomodoro = usePomodoro(timezone);

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  // Refresh tasks periodically when timer is running
  useEffect(() => {
    if (pomodoro.isRunning || pomodoro.isPaused) {
      const interval = setInterval(() => refetchTasks(), 30000);
      return () => clearInterval(interval);
    }
  }, [pomodoro.isRunning, pomodoro.isPaused, refetchTasks]);

  const actionableTasks = useMemo(() => {
    return tasks.filter(t => ACTIONABLE_STATUSES.includes(t.status));
  }, [tasks]);

  const enrichedTasks = useMemo(() => {
    return actionableTasks.map(task => {
      const project = projects.find(p => p.id === task.project_id);
      const area = project ? areas.find(a => a.id === project.area) : null;
      return {
        ...task,
        project_title: project ? project.title : null,
        area_id: area ? area.id : 'general',
        area_color: area ? area.color_hex : '#95A5A6',
      };
    });
  }, [actionableTasks, projects, areas]);

  const selectedTaskEnriched = useMemo(() => {
    if (!pomodoro.selectedTask) return null;
    return enrichedTasks.find(t => t.id === pomodoro.selectedTask.id) || pomodoro.selectedTask;
  }, [pomodoro.selectedTask, enrichedTasks]);

  const getAreaColor = (task) => {
    if (!task) return '#3498DB';
    return task.area_color || '#3498DB';
  };

  const handleTaskUpdate = (updatedTask) => {
    refetchTasks();
  };

  const handleSelectTask = async (task) => {
    // If a timer is running, abandon it first
    if (pomodoro.isRunning || pomodoro.isPaused || pomodoro.isBreakRunning) {
      pomodoro.abandonPomodoro();
    }
    pomodoro.selectTask(task);
  };

  const handlePlay = async () => {
    if (!pomodoro.selectedTask) return;
    // Auto-transition Inbox/Next Step -> In Progress on first pomodoro start
    if (
      pomodoro.selectedTask.status === '01 - Inbox' ||
      pomodoro.selectedTask.status === '02 - Next Step'
    ) {
      try {
        await updateTask(pomodoro.selectedTask.id, { status: '03 - In Progress' });
        refetchTasks();
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    }
    pomodoro.startPomodoro();
  };

  const isRunning = pomodoro.isRunning;
  const isPaused = pomodoro.isPaused;
  const isBreakReady = pomodoro.isBreakReady;
  const isBreakRunning = pomodoro.isBreakRunning;
  const isActive = isRunning || isPaused || isBreakRunning || isBreakReady;

  const durationForTimer = isBreakRunning
    ? pomodoro.breakDuration
    : isBreakReady
      ? pomodoro.pomodoroDuration
      : pomodoro.pomodoroDuration;

  const timerColor = selectedTaskEnriched ? getAreaColor(selectedTaskEnriched) : '#3498DB';

  return (
    <div className={`pomodoro-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Toggle Tab */}
      <button
        type="button"
        className="pomodoro-panel-toggle"
        onClick={() => setIsExpanded(prev => !prev)}
        title={isExpanded ? 'Collapse Focus Panel' : 'Open Focus Panel'}
      >
        {isActive && !isExpanded ? (
          <span className="pomodoro-panel-toggle-active" style={{ background: timerColor }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isExpanded ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        )}
        {!isExpanded && <span className="pomodoro-panel-toggle-label">Focus</span>}
      </button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="pomodoro-panel-content">
          {/* Header */}
          <div className="pomodoro-panel-header">
            <div className="pomodoro-header-row">
              <div className="pomodoro-duration-group">
                <label className="pomodoro-duration-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={pomodoro.pomodoroDuration}
                    onChange={(e) => pomodoro.setPomodoroDuration(parseInt(e.target.value, 10) || 25)}
                    disabled={isActive}
                    className="pomodoro-duration-input"
                  />
                  <span>min</span>
                </label>
                <label className="pomodoro-duration-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12H4" />
                    <path d="M20 18H4" />
                    <path d="M20 6H4" />
                  </svg>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={pomodoro.breakDuration}
                    onChange={(e) => pomodoro.setBreakDuration(parseInt(e.target.value, 10) || 5)}
                    disabled={isActive}
                    className="pomodoro-duration-input"
                  />
                  <span>break</span>
                </label>
              </div>

              <div className="pomodoro-controls">
                {isRunning && (
                  <button
                    type="button"
                    className="pomodoro-btn pomodoro-btn-pause"
                    onClick={pomodoro.pausePomodoro}
                    title="Pause"
                    style={{ color: timerColor }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    className="pomodoro-btn pomodoro-btn-play"
                    onClick={pomodoro.resumePomodoro}
                    title="Resume"
                    style={{ color: timerColor }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                )}
                {isBreakReady && (
                  <>
                    <button
                      type="button"
                      className="pomodoro-btn pomodoro-btn-play"
                      onClick={pomodoro.startBreak}
                      title="Start Break"
                      style={{ color: '#2ECC71' }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v6" />
                        <path d="M12 16v6" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="pomodoro-btn pomodoro-btn-skip"
                      onClick={pomodoro.skipBreak}
                      title="Skip Break"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 4 15 12 5 20 5 4" />
                        <line x1="19" y1="5" x2="19" y2="19" />
                      </svg>
                    </button>
                  </>
                )}
                {!isActive && (
                  <button
                    type="button"
                    className="pomodoro-btn pomodoro-btn-play"
                    onClick={handlePlay}
                    disabled={!pomodoro.selectedTask}
                    title="Start Pomodoro"
                    style={{ color: timerColor }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    className="pomodoro-btn pomodoro-btn-stop"
                    onClick={pomodoro.abandonPomodoro}
                    title="Stop / Abandon"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Timer Ring */}
          <div className="pomodoro-timer-area">
            <PomodoroTimer
              duration={durationForTimer}
              remaining={pomodoro.remainingSeconds}
              color={timerColor}
              isBreak={isBreakRunning}
              isPaused={isPaused}
            />
          </div>

          {/* Selected Task or Task List */}
          <div className="pomodoro-task-area">
            {isBreakReady ? (
              <div className="pomodoro-break-ready">
                <div className="pomodoro-break-ready-icon">🎉</div>
                <p className="pomodoro-break-ready-text">Pomodoro complete!</p>
                <p className="pomodoro-break-ready-sub">Take a {pomodoro.breakDuration}-minute break?</p>
              </div>
            ) : selectedTaskEnriched ? (
              <>
                <PomodoroTaskCard
                  task={selectedTaskEnriched}
                  isSelected={true}
                  areaColor={getAreaColor(selectedTaskEnriched)}
                  onSelect={() => {}}
                  onTaskUpdate={handleTaskUpdate}
                />

                {/* Distraction Notes - only visible when timer is active */}
                {(isRunning || isPaused || isBreakRunning) && (
                  <div className="pomodoro-notes-section">
                    <div className="pomodoro-notes-header">
                      <label className="pomodoro-notes-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                          <path d="M16 13H8" />
                          <path d="M16 17H8" />
                          <path d="M10 9H8" />
                        </svg>
                        Distraction capture
                      </label>
                      <button
                        type="button"
                        className="pomodoro-notes-save-btn"
                        onClick={pomodoro.saveDistractionNotesNow}
                        disabled={!pomodoro.distractionNotes || !pomodoro.distractionNotes.trim()}
                        title="Save notes now"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Save
                      </button>
                    </div>
                    <textarea
                      className="pomodoro-notes-textarea"
                      placeholder="Jot down any thoughts so you can refocus…"
                      value={pomodoro.distractionNotes}
                      onChange={(e) => pomodoro.setDistractionNotes(e.target.value)}
                    />
                  </div>
                )}

                {/* Show other tasks only when idle */}
                {!isActive && (
                  <div className="pomodoro-other-tasks">
                    <div className="pomodoro-other-tasks-header">
                      <span>Other actionable tasks</span>
                      <span className="pomodoro-task-count">{actionableTasks.length - 1}</span>
                    </div>
                    <div className="pomodoro-task-list">
                      {enrichedTasks
                        .filter(t => t.id !== selectedTaskEnriched.id)
                        .map(task => (
                          <PomodoroTaskCard
                            key={task.id}
                            task={task}
                            isSelected={false}
                            areaColor={getAreaColor(task)}
                            onSelect={handleSelectTask}
                            onTaskUpdate={handleTaskUpdate}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="pomodoro-no-task">
                <p>Select a task to begin focusing.</p>
              </div>
            )}

            {/* Search bar — always visible so you can switch tasks anytime */}
            <div className="pomodoro-search-wrapper">
              <TaskSearchPopover
                tasks={enrichedTasks}
                selectedTask={selectedTaskEnriched}
                onSelect={handleSelectTask}
                onCreate={handleTaskUpdate}
              />
            </div>
          </div>

          {/* Pause Overlay */}
          {isPaused && (
            <div className="pomodoro-pause-overlay">
              <div className="pomodoro-pause-overlay-content glass-panel-strong">
                <div className="pomodoro-pause-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="10" y1="15" x2="10" y2="9" />
                    <line x1="14" y1="15" x2="14" y2="9" />
                  </svg>
                </div>
                <p className="pomodoro-pause-title">Session paused</p>
                <p className="pomodoro-pause-message">
                  Pausing breaks your flow. Every interruption makes it harder to return to deep work.
                </p>
                <button
                  type="button"
                  className="btn btn-primary pomodoro-resume-btn"
                  onClick={pomodoro.resumePomodoro}
                  style={{ background: timerColor }}
                >
                  Resume Focus
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
