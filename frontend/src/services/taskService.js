import api from './api';

// Module Lịch công việc. Khoảng ngày (from/to) là chuỗi ISO do src/utils/taskDates.js
// dựng từ tháng đang xem — backend chặn khoảng quá 200 ngày nên đừng gộp nhiều tháng.
export const getMyTasks = (from, to) => api.get('/tasks/mine', { params: { from, to } });
export const getAssignedTasks = (from, to) => api.get('/tasks/assigned', { params: { from, to } });

// Vài việc gần hạn nhất, dùng cho ô tóm tắt ngoài Dashboard (backend tự giới hạn số dòng).
export const getUpcomingTasks = () => api.get('/tasks/upcoming');

export const createTask = (payload) => api.post('/tasks', payload);
export const updateTask = (taskId, payload) => api.put(`/tasks/${taskId}`, payload);
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`);

// Chỉ đổi trạng thái; các mốc StartedAt/CompletedAt do backend tự đóng dấu để tiến độ
// không thể bị khai man từ client.
export const updateTaskStatus = (taskId, Status) => api.patch(`/tasks/${taskId}/status`, { Status });
