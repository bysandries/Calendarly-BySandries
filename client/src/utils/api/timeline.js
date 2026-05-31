import { api } from './core';

export const fetchTimelineItems = (params = {}) => api.get('/timeline', params);
export const fetchTimelineItem  = (id)          => api.get(`/timeline/${id}`);
export const createTimelineItem = (body)        => api.post('/timeline', body);
export const updateTimelineItem = (id, body)    => api.put(`/timeline/${id}`, body);
export const deleteTimelineItem = (id)          => api.delete(`/timeline/${id}`);
export const addTimelineLink    = (id, body)    => api.post(`/timeline/${id}/links`, body);
export const deleteTimelineLink = (id, linkId)  => api.delete(`/timeline/${id}/links/${linkId}`);
