import { api } from './core';

export const fetchOpenCodeSessions = () => api.get('/opencode/sessions');
export const fetchOpenCodeStats = () => api.get('/opencode/stats');
export const syncOpenCode = () => api.get('/opencode/sync');
