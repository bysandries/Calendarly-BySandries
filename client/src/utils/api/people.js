import { api } from './core';

export const fetchPeople = () => api.get('/people');
export const createPerson = (data) => api.post('/people', data);
export const updatePerson = (id, data) => api.patch(`/people/${id}`, data);
export const deletePerson = (id) => api.delete(`/people/${id}`);
