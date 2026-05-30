import { api } from './core';

export const fetchAreas = () => api.get('/areas');
export const createArea = (data) => api.post('/areas', data);
export const updateArea = (id, data) => api.patch(`/areas/${id}`, data);
export const updateAreaColor = (id, color_hex) => updateArea(id, { color_hex });
export const deleteArea = (id) => api.delete(`/areas/${id}`);
export const archiveArea = (id) => api.patch(`/areas/${id}`, { is_archived: true });
export const unarchiveArea = (id) => api.patch(`/areas/${id}`, { is_archived: false });
