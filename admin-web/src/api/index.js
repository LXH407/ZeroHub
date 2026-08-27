import request from './request';

export const adminLogin = data => request.post('/api/admin/login', data);
export const getAdminInfo = () => request.get('/api/admin/info');
export const changeAdminPassword = data => request.post('/api/admin/change-password', data);

export const getStats = () => request.get('/api/admin/stats');
export const getSettings = () => request.get('/api/admin/settings');
export const updateSettings = data => request.post('/api/admin/settings', data);

export const getUsers = params => request.get('/api/admin/users', { params });
export const banUser = id => request.post(`/api/admin/users/${id}/ban`);
export const unbanUser = id => request.post(`/api/admin/users/${id}/unban`);
export const confirmUser = id => request.post(`/api/admin/users/${id}/confirm`);
export const cancelUser = id => request.post(`/api/admin/users/${id}/cancel`);
export const updateUserVip = (id, data) => request.post(`/api/admin/users/${id}/vip`, data);

export const generateCards = data => request.post('/api/cards/generate', data);
export const getCards = params => request.get('/api/cards/list', { params });
export const banCard = id => request.post(`/api/cards/ban/${id}`);
export const unbanCard = id => request.post(`/api/cards/unban/${id}`);
export const deleteCard = id => request.delete(`/api/cards/${id}`);

export const getResources = params => request.get('/api/resources/admin/list', { params });
export const createResource = data => request.post('/api/resources/admin', data);
export const updateResource = (id, data) => request.put(`/api/resources/admin/${id}`, data);
export const deleteResource = id => request.delete(`/api/resources/admin/${id}`);
export const uploadFile = formData => request.post('/api/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const getMirrors = () => request.get('/api/admin/mirrors');
export const updateMirrors = data => request.post('/api/admin/mirrors', { mirrors: data });
export const getPendingRegistrations = params => request.get('/api/admin/pending-registrations', { params });
export const processPending = () => request.post('/api/admin/process-pending');
