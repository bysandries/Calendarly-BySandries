import { api } from './core';

export const fetchPomodoroSessions = (filters) => api.get('/pomodoro-sessions', filters);
export const fetchPomodoroSession = (id) => api.get(`/pomodoro-sessions/${id}`);
export const createPomodoroSession = (data) => api.post('/pomodoro-sessions', data);
export const updatePomodoroSession = (id, data) => api.patch(`/pomodoro-sessions/${id}`, data);
export const deletePomodoroSession = (id) => api.delete(`/pomodoro-sessions/${id}`);
export const fetchPomodoroTimeByTask = () => api.get('/pomodoro-sessions/by-task');
