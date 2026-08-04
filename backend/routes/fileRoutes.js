const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { poolPromise } = require('../config/db');
const { logError } = require('../utils/errorLogger');

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../uploads');

// Cùng quy tắc xem bài với getAllNews (newsController.js) — role nào thấy được bài
// trên danh sách thì được tải file gắn với bài đó, tránh 2 nơi lệch nhau.
const VIEW_ALL_ROLES = ['admin', 'người duyệt', 'trưởng ban', 'kiểm soát viên'];

// Cấu hình multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const now = new Date();
        const dateFolder = `${now.getUTCFullYear()}\\${String(now.getUTCMonth()+1).padStart(2,'0')}\\${String(now.getUTCDate()).padStart(2,'0')}`;
        const fullFolder = path.join(STORAGE_ROOT, dateFolder);
        fs.mkdirSync(fullFolder, { recursive: true });
        cb(null, fullFolder);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}_${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
        const random = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}_${random}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.doc', '.docx', '.pdf'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận .doc, .docx, .pdf'));
        }
    }
});

// POST /api/file/upload
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không có file' });

    const now = new Date();
    const datePart = `${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${String(now.getUTCDate()).padStart(2,'0')}`;

    // Lưu có prefix Storage/ đồng nhất với WPF
    const storedPath = `Storage/${datePart}/${req.file.filename}`;

    console.log('✅ Upload thành công:', storedPath);

    res.json({
        success: true,
        storedPath,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

// GET /api/file/download?path=Storage/2026/04/22/filename.docx
router.get('/download', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Thiếu đường dẫn file' });

    // Trước đây chỉ có verifyToken — bất kỳ user đã đăng nhập (kể cả CTV) biết được
    // StoragePath của bài người khác đều tải được. Giờ so path với bài viết chủ của
    // nó trong DB, áp đúng quy tắc xem bài như getAllNews (VIEW_ALL_ROLES thấy hết,
    // "thư ký" chỉ bài đã duyệt, còn lại chỉ chủ bài).
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('StoragePath', filePath)
            .query('SELECT AuthorID, StatusID FROM dbo.Posts WHERE StoragePath = @StoragePath');
        const post = result.recordset[0];

        const userRole  = (req.user.Role || req.user.role || '').toLowerCase();
        const canViewAll = VIEW_ALL_ROLES.includes(userRole);

        if (!canViewAll) {
            if (!post) return res.status(403).json({ error: 'Truy cập bị từ chối' });
            const ownedByMe   = post.AuthorID === req.user.UserID;
            const secretaryOk = userRole === 'thư ký' && post.StatusID === 2;
            if (!ownedByMe && !secretaryOk) return res.status(403).json({ error: 'Truy cập bị từ chối' });
        }
    } catch (err) {
        logError({ source: 'fileRoutes.download', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        return res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }

    // Bỏ prefix "Storage/" nếu có
    const cleaned = filePath.replace(/^Storage\//, '');

    // Ghép đường dẫn
    const fullPath = path.resolve(STORAGE_ROOT, cleaned);
    const rootResolved = path.resolve(STORAGE_ROOT);

    console.log('📂 STORAGE_ROOT:', rootResolved);
    console.log('📂 fullPath:', fullPath);

    // ✅ Dùng path.resolve để so sánh chính xác trên cả Windows lẫn Linux — kèm path.sep
    // để tránh bị qua mặt bởi thư mục anh em cùng tiền tố (vd "STORAGE_ROOT_backup").
    if (fullPath !== rootResolved && !fullPath.startsWith(rootResolved + path.sep)) {
        console.log('❌ Bị chặn bảo mật');
        return res.status(403).json({ error: 'Truy cập bị từ chối' });
    }

    if (!fs.existsSync(fullPath)) {
        console.log('❌ Không tìm thấy file:', fullPath);
        return res.status(404).json({ error: 'File không tồn tại' });
    }

    res.download(fullPath);
});

module.exports = router;