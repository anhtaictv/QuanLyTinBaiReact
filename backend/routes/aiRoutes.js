const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const aiController = require('../controllers/aiController');
const ragController = require('../controllers/ragController');
const { requireRoles } = require('../middleware/authMiddleware');

// Rate limit riêng, chặt hơn apiLimiter chung (600 lượt/5 phút): mỗi lượt hỏi trợ lý
// chiếm Ollama máy A hàng chục giây, và nếu Ollama chết thì rơi xuống Claude tính tiền
// theo token. Đếm theo user chứ không theo IP vì cả cơ quan dùng chung 1 IP văn phòng.
const assistantLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.UserID || req.ip),
    message: { error: 'Bạn đang hỏi trợ lý quá nhanh, vui lòng chờ một lát rồi thử lại.' }
});

// Ai được nạp/xóa tài liệu vào kho tri thức RAG — cùng nhóm role được quyền duyệt bài
// (không mở cho CTV/Người duyệt, tránh ai cũng nạp/xóa văn bản quy định).
const RAG_MANAGE_ROLES = ['admin', 'trưởng ban', 'thư ký'];

router.get('/health', aiController.health);

// Module 5: Trợ lý hỏi đáp tự do (hội thoại nhiều lượt, hỏi chủ đề gì cũng được)
router.post('/chat', assistantLimiter, aiController.chat);

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
