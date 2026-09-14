import api from './api';

export const getConversations = () => api.get('/chat/conversations');
export const getMessages = (conversationId, before) =>
  api.get(`/chat/conversations/${conversationId}/messages`, { params: before ? { before } : {} });
export const createConversation = (memberIds, isGroup, title) =>
  api.post('/chat/conversations', { memberIds, isGroup, title });
export const getMembers = (conversationId) =>
  api.get(`/chat/conversations/${conversationId}/members`);
export const addMember = (conversationId, userId) =>
  api.post(`/chat/conversations/${conversationId}/members`, { userId });
export const removeMember = (conversationId, userId) =>
  api.delete(`/chat/conversations/${conversationId}/members/${userId}`);
export const uploadChatFile = (formData) =>
  api.post('/chat/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getBasicUsers = () => api.get('/users/basic');
export const editMessage = (messageId, content) =>
  api.patch(`/chat/messages/${messageId}`, { content });
export const recallMessage = (messageId) =>
  api.post(`/chat/messages/${messageId}/recall`);
export const deleteMessageForMe = (messageId) =>
  api.delete(`/chat/messages/${messageId}`);
