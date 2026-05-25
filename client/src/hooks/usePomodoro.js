import { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  createPomodoroSession,
  updatePomodoroSession,
  syncEventBlock,
  createDistractionNotesBatch,
} from '../utils/api';

const STORAGE_KEY = 'calendarly_pomodoro_state';

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2);
  } catch (_) {
    // Silently fail if audio not supported
  }
}

export function usePomodoro(timezone) {
  const [timerState, setTimerState] = useState('idle'); // idle | running | paused | break-ready | break-running
  const [selectedTask, setSelectedTask] = useState(null);
  const [session, setSession] = useState(null);
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem('calendarly_pomo_duration');
    return saved ? parseInt(saved, 10) : 25;
  });
  const [breakDuration, setBreakDuration] = useState(() => {
    const saved = localStorage.getItem('calendarly_pomo_break');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [remainingSeconds, setRemainingSeconds] = useState(pomodoroDuration * 60);
  const [distractionNotes, setDistractionNotes] = useState('');

  // Keep remainingSeconds in sync with duration while idle
  useEffect(() => {
    if (timerState === 'idle') {
      setRemainingSeconds(pomodoroDuration * 60);
    }
  }, [pomodoroDuration, timerState]);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState(null);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);
  const startTimeRef = useRef(null);

  // Save durations to localStorage
  useEffect(() => {
    localStorage.setItem('calendarly_pomo_duration', String(pomodoroDuration));
  }, [pomodoroDuration]);

  useEffect(() => {
    localStorage.setItem('calendarly_pomo_break', String(breakDuration));
  }, [breakDuration]);

  // Restore state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.session && saved.timerState === 'running') {
          const now = Date.now();
          const elapsedSinceSave = now - saved.savedAt;
          const newRemaining = Math.max(0, saved.remainingSeconds * 1000 - elapsedSinceSave);
          if (newRemaining > 0) {
            setTimerState('running');
            setSelectedTask(saved.selectedTask);
            setSession(saved.session);
            setRemainingSeconds(Math.round(newRemaining / 1000));
            setDistractionNotes(saved.distractionNotes || '');
            setTotalPausedMs(saved.totalPausedMs || 0);
            startTimeRef.current = now - ((saved.session.planned_duration_minutes * 60 - Math.round(newRemaining / 1000)) * 1000 + (saved.totalPausedMs || 0));
            // Restart countdown from remaining time
            startCountdown(Math.round(newRemaining / 1000), () => {
              setTimerState('break-ready');
              playChime();
              updatePomodoroSession(saved.session.id, {
                status: 'completed',
                ended_at: new Date().toISOString(),
                actual_duration_minutes: saved.session.planned_duration_minutes,
              }).then((completed) => {
                setSession(completed);
                createMeasureEvent(saved.selectedTask, saved.session.planned_duration_minutes, false, saved.distractionNotes || '');
              });
            });
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state before unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (timerState === 'running' || timerState === 'paused' || timerState === 'break-running') {
        const payload = {
          timerState,
          selectedTask,
          session,
          remainingSeconds,
          distractionNotes,
          totalPausedMs,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [timerState, selectedTask, session, remainingSeconds, distractionNotes, totalPausedMs]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start the countdown interval
  const startCountdown = useCallback((durationSeconds, onComplete) => {
    clearTimer();
    setRemainingSeconds(durationSeconds);
    const endAt = Date.now() + durationSeconds * 1000;
    endTimeRef.current = endAt;
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.round((endAt - now) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        clearTimer();
        if (onComplete) onComplete();
      }
    }, 1000);
  }, [clearTimer]);

  const createMeasureEvent = useCallback(async (task, durationMinutes, isBreak = false, notes = '') => {
    if (!task) return;
    if (durationMinutes < (isBreak ? 1 : 10)) return;

    const now = DateTime.now().setZone(timezone || 'America/Los_Angeles');
    const dateStr = now.toFormat('yyyy-MM-dd');
    const timeStr = now.toFormat('HH:mm');
    const title = isBreak ? 'Break' : task.title;
    const area = isBreak ? 'general' : (task.area_id || 'general');
    // For non-break events, try to get area color from task/project context
    const colorHex = isBreak ? '#95A5A6' : (task.area_color || '#3498DB');

    try {
      await syncEventBlock({
        block_signature: `${dateStr}_${timeStr}_measure_${task.id || 'break'}_${Date.now()}`,
        title,
        area,
        color_hex: colorHex,
        date_string: dateStr,
        time_slot: timeStr,
        duration_mins: durationMinutes,
        column_type: 'measure',
        notes: notes || `Pomodoro session. ${isBreak ? 'Break' : 'Focused work'}.`,
        timezone: timezone || 'America/Los_Angeles',
      });
    } catch (err) {
      console.error('Failed to create measure event:', err);
    }
  }, [timezone]);

  const saveDistractionNotes = useCallback(async (task, sessionId, notesText) => {
    if (!task || !notesText || !notesText.trim()) return;
    const lines = notesText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const now = new Date().toISOString();
    const entries = lines.map(content => ({ content, created_at: now }));
    try {
      await createDistractionNotesBatch({
        task_id: task.id,
        pomodoro_session_id: sessionId,
        entries,
      });
    } catch (err) {
      console.error('Failed to save distraction notes:', err);
    }
  }, []);

  const saveDistractionNotesNow = useCallback(async () => {
    if (!selectedTask || !session || !distractionNotes || !distractionNotes.trim()) return;
    const lines = distractionNotes.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const now = new Date().toISOString();
    const entries = lines.map(content => ({ content, created_at: now }));
    try {
      await createDistractionNotesBatch({
        task_id: selectedTask.id,
        pomodoro_session_id: session.id,
        entries,
      });
    } catch (err) {
      console.error('Failed to save distraction notes:', err);
    }
  }, [selectedTask, session, distractionNotes]);

  const startPomodoro = useCallback(async () => {
    if (!selectedTask) return;

    const newSession = await createPomodoroSession({
      task_id: selectedTask.id,
      planned_duration_minutes: pomodoroDuration,
      break_duration_minutes: breakDuration,
      notes: '',
    });

    setSession(newSession);
    setTimerState('running');
    setTotalPausedMs(0);
    setPauseStartTime(null);
    startTimeRef.current = Date.now();

    startCountdown(pomodoroDuration * 60, () => {
      // Timer complete callback
      setTimerState('break-ready');
      playChime();
      // Auto-complete the session on the server
      updatePomodoroSession(newSession.id, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        actual_duration_minutes: pomodoroDuration,
        notes: distractionNotes,
      }).then((completed) => {
        setSession(completed);
        saveDistractionNotes(selectedTask, newSession.id, distractionNotes);
        createMeasureEvent(selectedTask, pomodoroDuration, false, distractionNotes);
      });
    });
  }, [selectedTask, pomodoroDuration, breakDuration, startCountdown, createMeasureEvent, saveDistractionNotes, distractionNotes]);

  const pausePomodoro = useCallback(async () => {
    if (timerState !== 'running' || !session) return;
    clearTimer();
    setTimerState('paused');
    setPauseStartTime(Date.now());
    await updatePomodoroSession(session.id, { status: 'paused' });
  }, [timerState, session, clearTimer]);

  const resumePomodoro = useCallback(async () => {
    if (timerState !== 'paused' || !session) return;
    const pausedDuration = pauseStartTime ? Date.now() - pauseStartTime : 0;
    const newTotalPaused = totalPausedMs + pausedDuration;
    setTotalPausedMs(newTotalPaused);
    setPauseStartTime(null);
    setTimerState('running');
    await updatePomodoroSession(session.id, { status: 'active' });
    // Resume from remaining seconds
    startCountdown(remainingSeconds, () => {
      setTimerState('break-ready');
      playChime();
      updatePomodoroSession(session.id, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        actual_duration_minutes: Math.round((pomodoroDuration * 60000 - newTotalPaused) / 60000),
        notes: distractionNotes,
      }).then((completed) => {
        setSession(completed);
        const actualMin = Math.round((pomodoroDuration * 60000 - newTotalPaused) / 60000);
        saveDistractionNotes(selectedTask, session.id, distractionNotes);
        createMeasureEvent(selectedTask, actualMin, false, distractionNotes);
      });
    });
  }, [timerState, session, pauseStartTime, totalPausedMs, remainingSeconds, startCountdown, pomodoroDuration, createMeasureEvent, saveDistractionNotes, selectedTask, distractionNotes]);

  const abandonPomodoro = useCallback(async () => {
    if (!session) return;
    clearTimer();
    const now = Date.now();
    const elapsedMs = now - startTimeRef.current - totalPausedMs;
    const actualMinutes = Math.max(0, Math.round(elapsedMs / 60000));

    await updatePomodoroSession(session.id, {
      status: 'abandoned',
      ended_at: new Date().toISOString(),
      actual_duration_minutes: actualMinutes,
      notes: distractionNotes,
    });

    // Create measure event if >= 10 minutes
    if (actualMinutes >= 10) {
      await createMeasureEvent(selectedTask, actualMinutes, false, distractionNotes);
    }

    // Save each distraction line as a separate entry
    await saveDistractionNotes(selectedTask, session.id, distractionNotes);

    setTimerState('idle');
    setSession(null);
    setRemainingSeconds(pomodoroDuration * 60);
    setDistractionNotes('');
    setTotalPausedMs(0);
    setPauseStartTime(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [session, clearTimer, totalPausedMs, pomodoroDuration, createMeasureEvent, saveDistractionNotes, selectedTask, distractionNotes]);

  const startBreak = useCallback(() => {
    setTimerState('break-running');
    startCountdown(breakDuration * 60, () => {
      setTimerState('idle');
      setSession(null);
      setRemainingSeconds(pomodoroDuration * 60);
      setDistractionNotes('');
      setTotalPausedMs(0);
      setPauseStartTime(null);
      // Log break as measure event (even 1 min breaks count)
      createMeasureEvent(selectedTask, breakDuration, true, 'Pomodoro break');
      localStorage.removeItem(STORAGE_KEY);
    });
  }, [breakDuration, pomodoroDuration, startCountdown, createMeasureEvent, selectedTask]);

  const skipBreak = useCallback(() => {
    setTimerState('idle');
    setSession(null);
    setRemainingSeconds(pomodoroDuration * 60);
    setDistractionNotes('');
    setTotalPausedMs(0);
    setPauseStartTime(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [pomodoroDuration]);

  const selectTask = useCallback((task) => {
    setSelectedTask(task);
    if (timerState === 'idle') {
      // If idle, just select. If running, we don't allow switching without abandoning.
    }
  }, [timerState]);

  const isRunning = timerState === 'running';
  const isPaused = timerState === 'paused';
  const isBreakReady = timerState === 'break-ready';
  const isBreakRunning = timerState === 'break-running';

  // Compute actual elapsed minutes for display
  const elapsedMinutes = useCallback(() => {
    if (!startTimeRef.current) return 0;
    const extraPaused = pauseStartTime ? Date.now() - pauseStartTime : 0;
    const elapsedMs = Date.now() - startTimeRef.current - totalPausedMs - extraPaused;
    return Math.max(0, Math.round(elapsedMs / 60000));
  }, [totalPausedMs, pauseStartTime]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    timerState,
    isRunning,
    isPaused,
    isBreakReady,
    isBreakRunning,
    selectedTask,
    session,
    pomodoroDuration,
    breakDuration,
    remainingSeconds,
    distractionNotes,
    setPomodoroDuration,
    setBreakDuration,
    setDistractionNotes,
    selectTask,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    abandonPomodoro,
    startBreak,
    skipBreak,
    elapsedMinutes,
    saveDistractionNotesNow,
  };
}
