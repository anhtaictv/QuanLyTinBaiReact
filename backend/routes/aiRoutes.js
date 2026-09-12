const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const router = express.Router();
const aiController = require('../controllers/aiController');
const ragController = require('../controllers/ragController');
const { requireRoles } = require('../middleware/authMiddleware');

// 25MB, KHỚP với MAX_AUDIO_UPLOAD_MB của AI Gateway. Trước đây để 50MB: file 25-50MB được
// nạp trọn vào RAM của backend, đóng gói lại thành multipart, đẩy qua mạng sang gateway rồi
// mới ăn 413 ở đó — tốn RAM/băng thông cho một cái chắc chắn bị từ chối.
const MAX_AUDIO_UPLOAD_MB = 25;

// Cùng danh sách với ALLOWED_EXTENSIONS của gateway (services/transcription.js). Chặn sớm để
// file rác 25MB không phải đi hết một vòng backend -> gateway mới bị loại.
const ALLOWED_AUDIO_EXTENSIONS = ['wav', 'mp3', 'm4a', 'mp4', 'flac', 'ogg', 'opus', 'webm', 'aac', 'wma'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = String(file.originalname || '').split('.').pop().toLowerCase();
        if (ALLOWED_AUDIO_EXTENSIONS.includes(ext)) return cb(null, true);
        cb(new Error(`File "${file.originalname}" không phải định dạng audio được hỗ trợ. Dùng một trong: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}.`));
    }
});

// Lỗi của multer (quá cỡ) và của fileFilter đều là lỗi FILE NGƯỜI DÙNG GỬI, không phải sự cố
// server: không bắt ở đây thì nó rơi vào error handler mặc định của Express và trả về 500 kèm
// trang HTML, đúng thứ mà client đang chờ JSON {error} không đọc nổi.
const acceptAudioFile = (req, res, next) => upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
        ? `File vượt trần ${MAX_AUDIO_UPLOAD_MB}MB. Nén xuống bitrate thấp hơn hoặc cắt ngắn băng rồi thử lại.`
        : err.message;
    res.status(400).json({ error: message });
});

// Rã băng file dài được client cắt thành từng đoạn 25 giây, nên MỘT lần bấm của người dùng
// có thể là hàng chục request — apiLimiter chung (600 lượt/5 phút, đếm theo IP mà cả cơ quan
// dùng chung 1 IP) không bảo vệ được: một người rã băng 20 phút là đốt 48 lượt của cả tòa
// soạn. Trần này đếm theo user và vẫn đủ cho băng ~80 phút một lần.
const transcribeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.UserID || req.ip),
    message: { error: 'Bạn đang rã băng quá nhiều, vui lòng chờ vài phút rồi thử lại.' }
});

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

// Module rã băng phỏng vấn — file audio → Speech-to-Text (PhoWhisper) qua AI Gateway
router.post('/transcribe', transcribeLimiter, acceptAudioFile, aiController.transcribe);

// Module 5: Trợ lý hỏi đáp tự do (hội thoại nhiều lượt, hỏi chủ đề gì cũng được)
router.post('/chat', assistantLimiter, aiController.chat);

// Module 6: Hồ sơ văn phong cá nhân — chỉ đọc/cập nhật của chính mình, không cần chặn role.
// Refresh cũng tốn 1 lượt gọi AI Gateway như assistant nên dùng chung rate-limit.
router.get('/style-profile', aiController.getMyStyleProfile);
router.post('/style-profile/refresh', assistantLimiter, aiController.refreshMyStyleProfile);
router.put('/style-profile', aiController.updateMyStyleProfile);

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

// AI giám sát chất lượng: đối chiếu bài viết với corpus bài đã duyệt (fact-check) hoặc
// cẩm nang tòa soạn (consistency) — cùng nhóm quyền với /rag/ask, không giới hạn thêm.
router.post('/rag/factcheck', ragController.factcheck);
router.post('/rag/consistency', ragController.consistency);

module.exports = router;
