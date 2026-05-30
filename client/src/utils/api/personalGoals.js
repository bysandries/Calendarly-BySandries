import { api } from './core';

export const fetchGoals       = (params = {}) => api.get('/personal-goals', params);
export const fetchGoal        = (id)           => api.get(`/personal-goals/${id}`);
export const createGoal       = (body)         => api.post('/personal-goals', body);
export const updateGoal       = (id, body)     => api.put(`/personal-goals/${id}`, body);
export const deleteGoal       = (id)           => api.delete(`/personal-goals/${id}`);
export const archiveGoal      = (id)           => api.post(`/personal-goals/${id}/archive`, {});
export const completeGoal     = (id)           => api.post(`/personal-goals/${id}/complete`, {});
export const addGoalLink      = (id, body)     => api.post(`/personal-goals/${id}/links`, body);
export const deleteGoalLink   = (id, linkId)   => api.delete(`/personal-goals/${id}/links/${linkId}`);
