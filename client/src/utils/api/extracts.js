import { api } from './core';

export const fetchExtracts = (filters) => api.get('/extracts', filters);
export const fetchExtract = (id) => api.get(`/extracts/${id}`);
export const createExtract = (data) => api.post('/extracts', data);
export const updateExtract = (id, data) => api.patch(`/extracts/${id}`, data);
export const deleteExtract = (id) => api.delete(`/extracts/${id}`);
export const linkExtractResource = (id, data) => api.post(`/extracts/${id}/resources`, data);
export const unlinkExtractResource = (id, data) => api.delete(`/extracts/${id}/resources`, data);
export const fetchExtractLinks = (id) => api.get(`/extracts/${id}/links`);
export const addExtractLink = (id, targetId) => api.post(`/extracts/${id}/links`, { target_id: targetId });
export const removeExtractLink = (id, targetId) => api.delete(`/extracts/${id}/links/${targetId}`);
