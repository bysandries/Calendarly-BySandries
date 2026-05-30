import { api } from './core';

export const checkHealth = () => api.get('/health');
