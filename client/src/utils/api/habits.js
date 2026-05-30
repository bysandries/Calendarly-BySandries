import { api } from './core';

export const fetchHabits = (filters) => api.get('/habits', filters);
export const fetchHabit = (id) => api.get(`/habits/${id}`);
export const createHabit = (data) => api.post('/habits', data);
export const updateHabit = (id, data) => api.patch(`/habits/${id}`, data);
export const deleteHabit = (id) => api.delete(`/habits/${id}`);
