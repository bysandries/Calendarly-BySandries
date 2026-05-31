const API_BASE = '/api';
const TOKEN_KEY = 'calendarly_api_token';

export const getApiToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setApiToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearApiToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const token = getApiToken();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Token missing/invalid — drop it and signal the app to re-prompt.
    clearApiToken();
    window.dispatchEvent(new CustomEvent('calendarly:unauthorized'));
    throw new Error('Unauthorized — please re-enter your access token.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

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
