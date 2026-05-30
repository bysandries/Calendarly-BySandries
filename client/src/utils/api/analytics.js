import { api } from './core';

export const fetchWeeklyReport = (params) => api.get('/analytics/weekly-report', params);
