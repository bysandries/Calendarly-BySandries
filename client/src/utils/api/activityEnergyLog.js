import { api } from './core';

export const fetchEnergyLogs   = (params = {})  => api.get('/activity-energy-log', params);
export const fetchEnergySummary = (params = {}) => api.get('/activity-energy-log/summary', params);
export const createEnergyLog   = (body)          => api.post('/activity-energy-log', body);
export const deleteEnergyLog   = (id)            => api.delete(`/activity-energy-log/${id}`);
