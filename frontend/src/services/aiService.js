import api from './api';

export const getAiHealth = () => api.get('/ai/health');

// Module 1: Trợ lý biên tập
export const proofreadText = (text) => api.post('/ai/editorial/proofread', { text });
export const suggestHeadlines = (content) => api.post('/ai/editorial/headlines', { content });
export const summarizeContent = (content) => api.post('/ai/editorial/summarize', { content });

// Module 2: Phân loại & gắn tag tự động
export const categorizeContent = (content) => api.post('/ai/categorize', { content });

// Module 3: Kiểm duyệt & bảo mật thông tin
export const scanSensitive = (text) => api.post('/ai/scan-sensitive', { text });

// Module 4: RAG tra cứu văn bản quy định
export const listRagDocuments = () => api.get('/ai/rag/documents');
export const ingestRagDocument = (title, content) => api.post('/ai/rag/documents', { title, content });
export const deleteRagDocument = (sourceId) => api.delete(`/ai/rag/documents/${sourceId}`);
export const askRag = (question) => api.post('/ai/rag/ask', { question });
