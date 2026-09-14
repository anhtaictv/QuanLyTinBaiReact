import api from './api';

export const getUnreadErrorCount = () => api.get('/errors/unread-count');
export const getErrorLogs = (unreadOnly = false) => api.get('/errors', { params: { unreadOnly } });
export const markErrorRead = (id) => api.put(`/errors/${id}/read`);
export const markAllErrorsRead = () => api.put('/errors/read-all');
