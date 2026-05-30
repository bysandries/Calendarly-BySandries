import { api } from './core';

export const fetchEventsRange = (startDate, endDate) => api.get('/events', { start_date: startDate, end_date: endDate });
export const fetchEvents = (date) => api.get('/events', { date });
export const syncEventBlock = (data) => api.post('/events/sync-block', data);
export const logMeasure = (data) => api.post('/events/log-measure', data);
export const clonePlan = (id) => api.post('/events/clone-plan', { id });
export const deleteEvent = (id, scope = 'single') => api.delete(`/events/${id}?scope=${scope}`);
export const updateEvent = (id, data) => api.patch(`/events/${id}`, data);
export const fetchEventTasks = (eventId) => api.get(`/events/${eventId}/tasks`);
export const linkTaskToEvent = (eventId, taskId) => api.post(`/events/${eventId}/tasks`, { task_id: taskId });
export const unlinkTaskFromEvent = (eventId, taskId) => api.delete(`/events/${eventId}/tasks/${taskId}`);
