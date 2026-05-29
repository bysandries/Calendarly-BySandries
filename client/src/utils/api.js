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

  put: (endpoint, body) =>
    request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

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

export const fetchProjects = (filters) => api.get('/projects', filters);
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const fetchProjectSettings = (id) => api.get(`/projects/${id}/settings`);
export const updateProjectSettings = (id, data) => api.put(`/projects/${id}/settings`, data);

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
export const fetchExtractLinks = (id) => api.get(`/extracts/${id}/links`);
export const addExtractLink = (id, targetId) => api.post(`/extracts/${id}/links`, { target_id: targetId });
export const removeExtractLink = (id, targetId) => api.delete(`/extracts/${id}/links/${targetId}`);

// ── Areas ──

export const fetchAreas = () => api.get('/areas');
export const createArea = (data) => api.post('/areas', data);
export const updateArea = (id, data) => api.patch(`/areas/${id}`, data);
export const updateAreaColor = (id, color_hex) => updateArea(id, { color_hex });
export const deleteArea = (id) => api.delete(`/areas/${id}`);
export const archiveArea = (id) => api.patch(`/areas/${id}`, { is_archived: true });
export const unarchiveArea = (id) => api.patch(`/areas/${id}`, { is_archived: false });

// ── Events ──

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

// ── Daily Logs ──

export const fetchDailyLogsRange = (startDate, endDate) => api.get('/daily-logs', { start_date: startDate, end_date: endDate });
export const fetchDailyLog = (date) => api.get('/daily-logs', { date });
export const upsertDailyLog = (data) => api.post('/daily-logs', data);

// ── Health ──

export const checkHealth = () => api.get('/health');

// ── Analytics ──
export const fetchWeeklyReport = (params) => api.get('/analytics/weekly-report', params);

// ── Pomodoro Sessions ──

export const fetchPomodoroSessions = (filters) => api.get('/pomodoro-sessions', filters);
export const fetchPomodoroSession = (id) => api.get(`/pomodoro-sessions/${id}`);
export const createPomodoroSession = (data) => api.post('/pomodoro-sessions', data);
export const updatePomodoroSession = (id, data) => api.patch(`/pomodoro-sessions/${id}`, data);
export const deletePomodoroSession = (id) => api.delete(`/pomodoro-sessions/${id}`);
export const fetchPomodoroTimeByTask = () => api.get('/pomodoro-sessions/by-task');

// ── Distraction Notes ──

export const fetchDistractionNotes = (filters) => api.get('/distraction-notes', filters);
export const fetchDistractionNotesWithTasks = (filters) => api.get('/distraction-notes/with-tasks', filters);
export const createDistractionNote = (data) => api.post('/distraction-notes', data);
export const createDistractionNotesBatch = (data) => api.post('/distraction-notes/batch', data);
export const deleteDistractionNote = (id) => api.delete(`/distraction-notes/${id}`);

// ── Code Agent Sessions ──

export const fetchCodeAgentSessions = (filters) => api.get('/code-agents', filters);
export const fetchCodeAgentStats = () => api.get('/code-agents/stats');
export const createCodeAgentSession = (data) => api.post('/code-agents', data);
export const updateCodeAgentSession = (id, data) => api.patch(`/code-agents/${id}`, data);
export const deleteCodeAgentSession = (id) => api.delete(`/code-agents/${id}`);

// ── Habits ──

export const fetchHabits = (filters) => api.get('/habits', filters);
export const fetchHabit = (id) => api.get(`/habits/${id}`);
export const createHabit = (data) => api.post('/habits', data);
export const updateHabit = (id, data) => api.patch(`/habits/${id}`, data);
export const deleteHabit = (id) => api.delete(`/habits/${id}`);

// ── Habit Logs ──

export const fetchHabitLogs = (filters) => api.get('/habit-logs', filters);
export const fetchHabitsTodaySummary = () => api.get('/habit-logs/today-summary');
export const fetchHabitsWeeklySummary = () => api.get('/habit-logs/weekly-summary');
export const logHabit = (habit_id, data = {}) => api.post(`/habit-logs/quick/${habit_id}`, data);
export const createHabitLog = (data) => api.post('/habit-logs', data);
export const updateHabitLog = (id, data) => api.patch(`/habit-logs/${id}`, data);
export const deleteHabitLog = (id) => api.delete(`/habit-logs/${id}`);

// ── People ──

export const fetchPeople = () => api.get('/people');
export const createPerson = (data) => api.post('/people', data);
export const updatePerson = (id, data) => api.patch(`/people/${id}`, data);
export const deletePerson = (id) => api.delete(`/people/${id}`);

// ── OpenCode Sync ──

export const fetchOpenCodeSessions = () => api.get('/opencode/sessions');
export const fetchOpenCodeStats = () => api.get('/opencode/stats');
export const syncOpenCode = () => api.get('/opencode/sync');

// ── Personal Care Dashboard ──

export const fetchPersonalCareSummary = (weekStart) => {
  const params = weekStart ? { week_start: weekStart } : {};
  return api.get('/personal-care/summary', params);
};
