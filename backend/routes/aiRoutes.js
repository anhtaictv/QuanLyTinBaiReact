const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const ragController = require('../controllers/ragController');
const { requireRoles } = require('../middleware/authMiddleware');

// Ai được nạp/xóa tài liệu vào kho tri thức RAG — cùng nhóm role được quyền duyệt bài
// (không mở cho CTV/Người duyệt, tránh ai cũng nạp/xóa văn bản quy định).
const RAG_MANAGE_ROLES = ['admin', 'trưởng ban', 'thư ký'];

router.get('/health', aiController.health);

// Module 1: Trợ lý biên tập
router.post('/editorial/proofread', aiController.proofread);
router.post('/editorial/headlines', aiController.suggestHeadlines);
router.post('/editorial/summarize', aiController.summarize);

// Module 2: Phân loại & gắn tag tự động
router.post('/categorize', aiController.categorize);

// Module 3: Kiểm duyệt & bảo mật thông tin
router.post('/scan-sensitive', aiController.scanSensitive);

// Module 4: RAG tra cứu văn bản quy định
router.get('/rag/documents', ragController.listDocs);
router.post('/rag/documents', requireRoles(...RAG_MANAGE_ROLES), ragController.ingest);
router.delete('/rag/documents/:sourceId', requireRoles(...RAG_MANAGE_ROLES), ragController.deleteDoc);
router.post('/rag/ask', ragController.ask);

module.exports = router;
