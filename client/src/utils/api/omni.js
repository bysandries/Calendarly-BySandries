import { api } from './core';

export const analyzeOmniCapture = (text) => api.post('/omni-capture/analyze', { text });
export const executeOmniCapture = (payload) => api.post('/omni-capture/execute', payload);
export const fetchOmniHistory = () => api.get('/omni-capture/history');
export const deleteOmniEntity = (type, id) => api.delete(`/omni-capture/entity/${type}/${id}`);
