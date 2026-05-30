import { api } from './core';

export const fetchPersonalCareSummary = (weekStart) => {
  const params = weekStart ? { week_start: weekStart } : {};
  return api.get('/personal-care/summary', params);
};
