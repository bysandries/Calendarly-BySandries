import { api } from './core';

export const fetchDistractionNotes = (filters) => api.get('/distraction-notes', filters);
export const fetchDistractionNotesWithTasks = (filters) => api.get('/distraction-notes/with-tasks', filters);
export const createDistractionNote = (data) => api.post('/distraction-notes', data);
export const createDistractionNotesBatch = (data) => api.post('/distraction-notes/batch', data);
export const deleteDistractionNote = (id) => api.delete(`/distraction-notes/${id}`);
