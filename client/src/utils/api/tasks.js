import { api } from './core';

export const fetchTasks = (filters) => api.get('/tasks', filters);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export const fetchTrash = () => api.get('/tasks/trash');
export const restoreTask = (id) => api.post(`/tasks/trash/restore/${id}`, {});
export const hardDeleteTask = (id) => api.delete(`/tasks/trash/${id}`);
export const emptyTrash = () => api.delete('/tasks/trash');
