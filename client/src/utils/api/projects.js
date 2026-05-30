import { api } from './core';

export const fetchProjects = (filters) => api.get('/projects', filters);
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const fetchProjectSettings = (id) => api.get(`/projects/${id}/settings`);
export const updateProjectSettings = (id, data) => api.put(`/projects/${id}/settings`, data);
