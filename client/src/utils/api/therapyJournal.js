import { api } from './core';

export const fetchTherapyEntries = (params) => api.get('/therapy/entries', params);
export const fetchTherapyEntry = (id) => api.get(`/therapy/entries/${id}`);
export const createTherapyEntry = (data) => api.post('/therapy/entries', data);
export const updateTherapyEntry = (id, data) => api.patch(`/therapy/entries/${id}`, data);
export const deleteTherapyEntry = (id) => api.delete(`/therapy/entries/${id}`);

export const fetchTherapyPatterns = () => api.get('/therapy/patterns');
export const fetchTherapyPattern  = (id) => api.get(`/therapy/patterns/${id}`);
export const createTherapyPattern = (data) => api.post('/therapy/patterns', data);
export const updateTherapyPattern = (id, data) => api.patch(`/therapy/patterns/${id}`, data);
export const linkEntryPattern = (entryId, data) => api.post(`/therapy/entries/${entryId}/patterns`, data);
export const unlinkEntryPattern = (entryId, patternId) => api.delete(`/therapy/entries/${entryId}/patterns/${patternId}`);

export const fetchTherapyGoals = (params) => api.get('/therapy/goals', params);
export const createTherapyGoal = (data) => api.post('/therapy/goals', data);
export const updateTherapyGoal = (id, data) => api.patch(`/therapy/goals/${id}`, data);
export const reorderTherapyGoals = (order) => api.post('/therapy/goals/reorder', { order });

export const updateTherapyQuestion = (id, data) => api.patch(`/therapy/questions/${id}`, data);

export const fetchAvailableSleep  = (params) => api.get('/therapy/available-sleep', params);
export const fetchAvailableHabits = (params) => api.get('/therapy/available-habits', params);

export const fetchQuickEntries = (params) => api.get('/therapy/quick-entries', params);
export const createQuickEntry  = (data)   => api.post('/therapy/quick-entries', data);
export const updateQuickEntry  = (id, data) => api.patch(`/therapy/quick-entries/${id}`, data);
export const deleteQuickEntry  = (id)     => api.delete(`/therapy/quick-entries/${id}`);
