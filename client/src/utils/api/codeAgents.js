import { api } from './core';

export const fetchCodeAgentSessions = (filters) => api.get('/code-agents', filters);
export const fetchCodeAgentStats = () => api.get('/code-agents/stats');
export const createCodeAgentSession = (data) => api.post('/code-agents', data);
export const updateCodeAgentSession = (id, data) => api.patch(`/code-agents/${id}`, data);
export const deleteCodeAgentSession = (id) => api.delete(`/code-agents/${id}`);
