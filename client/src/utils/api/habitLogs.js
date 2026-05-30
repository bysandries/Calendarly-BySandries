import { api } from './core';

export const fetchHabitLogs = (filters) => api.get('/habit-logs', filters);
export const fetchHabitsTodaySummary = () => api.get('/habit-logs/today-summary');
export const fetchHabitsWeeklySummary = () => api.get('/habit-logs/weekly-summary');
export const logHabit = (habit_id, data = {}) => api.post(`/habit-logs/quick/${habit_id}`, data);
export const createHabitLog = (data) => api.post('/habit-logs', data);
export const updateHabitLog = (id, data) => api.patch(`/habit-logs/${id}`, data);
export const deleteHabitLog = (id) => api.delete(`/habit-logs/${id}`);
