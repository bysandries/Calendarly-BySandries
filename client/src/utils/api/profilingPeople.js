import { api, getApiToken } from './core';

// ── Categories ──────────────────────────────────────────────────────────────
export const fetchProfilingCategories = () => api.get('/profiling-people/categories');
export const createProfilingCategory = (data) => api.post('/profiling-people/categories', data);
export const updateProfilingCategory = (id, data) => api.patch(`/profiling-people/categories/${id}`, data);
export const archiveProfilingCategory = (id) => api.delete(`/profiling-people/categories/${id}`);

// ── People ──────────────────────────────────────────────────────────────────
export const fetchProfilingPeople = (filters) => api.get('/profiling-people', filters);
export const fetchProfilingPerson = (id) => api.get(`/profiling-people/${id}`);
export const createProfilingPerson = (data) => api.post('/profiling-people', data);
export const updateProfilingPerson = (id, data) => api.patch(`/profiling-people/${id}`, data);
export const deleteProfilingPerson = (id) => api.delete(`/profiling-people/${id}`);
export const fetchCategoryHistory = (personId) => api.get(`/profiling-people/${personId}/category-history`);

// ── Memories ────────────────────────────────────────────────────────────────
export const fetchPersonMemories = (personId) => api.get(`/profiling-people/${personId}/memories`);
export const createMemory = (personId, data) => api.post(`/profiling-people/${personId}/memories`, data);
export const updateMemory = (memoryId, data) => api.patch(`/profiling-people/memories/${memoryId}`, data);
export const deleteMemory = (memoryId) => api.delete(`/profiling-people/memories/${memoryId}`);

// ── Event Links ───────────────────────────────────────────────────────────────
export const linkMemoryEvent = (memoryId, eventId) => api.post(`/profiling-people/memories/${memoryId}/events`, { event_id: eventId });
export const unlinkMemoryEvent = (memoryId, eventId) => api.delete(`/profiling-people/memories/${memoryId}/events/${eventId}`);

// ── Attachments ───────────────────────────────────────────────────────────────
export const uploadAttachment = (personId, formData) => {
  return fetch(`/api/profiling-people/${personId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
    },
    body: formData,
  }).then(r => {
    if (!r.ok) return r.json().then(j => { throw new Error(j.error || `Upload failed: ${r.status}`); });
    return r.json();
  });
};

export const fetchAttachments = (personId) => api.get(`/profiling-people/${personId}/attachments`);
export const deleteAttachment = (id) => api.delete(`/profiling-people/attachments/${id}`);
export const updateAttachment = (id, data) => api.patch(`/profiling-people/attachments/${id}`, data);
export const downloadAttachmentUrl = (id) => `/api/attachments/${id}/download`;
