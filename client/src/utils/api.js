const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ── Generic Methods ──

export const api = {
  get: (endpoint, params) => {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
        ).toString()
      : '';
    return request(`${endpoint}${queryString}`);
  },

  post: (endpoint, body) =>
    request(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  patch: (endpoint, body) =>
    request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (endpoint) =>
    request(endpoint, { method: 'DELETE' }),
};

// ── Tasks ──

export const fetchTasks = (filters) => api.get('/tasks', filters);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

// ── Projects ──

export const fetchProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

// ── Notes ──

export const fetchNotes = (filters) => api.get('/notes', filters);
export const fetchNote = (id) => api.get(`/notes/${id}`);
export const createNote = (data) => api.post('/notes', data);
export const updateNote = (id, data) => api.patch(`/notes/${id}`, data);
export const deleteNote = (id) => api.delete(`/notes/${id}`);

// ── Extracts ──

export const fetchExtracts = (filters) => api.get('/extracts', filters);
export const fetchExtract = (id) => api.get(`/extracts/${id}`);
export const createExtract = (data) => api.post('/extracts', data);
export const updateExtract = (id, data) => api.patch(`/extracts/${id}`, data);
export const deleteExtract = (id) => api.delete(`/extracts/${id}`);
export const linkExtractResource = (id, data) => api.post(`/extracts/${id}/resources`, data);
export const unlinkExtractResource = (id, data) => api.delete(`/extracts/${id}/resources`, data);

// ── Areas ──

export const fetchAreas = () => api.get('/areas');
export const createArea = (data) => api.post('/areas', data);
export const updateArea = (id, data) => api.patch(`/areas/${id}`, data);
export const updateAreaColor = (id, color_hex) => updateArea(id, { color_hex });

// ── Events ──

export const fetchEventsRange = (startDate, endDate) => api.get('/events', { start_date: startDate, end_date: endDate });
export const fetchEvents = (date) => api.get('/events', { date });
export const syncEventBlock = (data) => api.post('/events/sync-block', data);
export const logMeasure = (data) => api.post('/events/log-measure', data);
export const clonePlan = (id) => api.post('/events/clone-plan', { id });
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const fetchEventTasks = (eventId) => api.get(`/events/${eventId}/tasks`);
export const linkTaskToEvent = (eventId, taskId) => api.post(`/events/${eventId}/tasks`, { task_id: taskId });
export const unlinkTaskFromEvent = (eventId, taskId) => api.delete(`/events/${eventId}/tasks/${taskId}`);

// ── Daily Logs ──

export const fetchDailyLogsRange = (startDate, endDate) => api.get('/daily-logs', { start_date: startDate, end_date: endDate });
export const fetchDailyLog = (date) => api.get('/daily-logs', { date });
export const upsertDailyLog = (data) => api.post('/daily-logs', data);

// ── Health ──

export const checkHealth = () => api.get('/health');

// ── Analytics ──
export const fetchWeeklyReport = (params) => api.get('/analytics/weekly-report', params);
