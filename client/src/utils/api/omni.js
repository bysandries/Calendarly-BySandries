import { api } from './core';

export const submitOmniCapture = (text) => api.post('/omni-capture', { text });
