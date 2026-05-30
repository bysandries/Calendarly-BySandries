import { api } from './core';

export const fetchDailyLogsRange = (startDate, endDate) => api.get('/daily-logs', { start_date: startDate, end_date: endDate });
export const fetchDailyLog = (date) => api.get('/daily-logs', { date });
export const upsertDailyLog = (data) => api.post('/daily-logs', data);
