const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { poolPromise } = require('./config/db');
const authController = require('./controllers/authController');
const newsRoutes = require('./routes/newsRoutes');
const fileRoutes = require('./routes/fileRoutes');
const { verifyToken, isAdmin } = require('./middleware/authMiddleware');
const driveRoutes = require('./routes/driveRoutes'); // ✅ chỉ require ở đây
const pushRoutes = require('./routes/pushRoutes');
const errorLogRoutes = require('./routes/errorLogRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { initChatSocket } = require('./sockets/chatSocket');
const { setIO } = require('./sockets/ioHolder');
const { logError } = require('./utils/errorLogger');

const app = express(); // ✅ khai báo app trước

// Middleware
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Chặn brute-force đăng nhập/đăng ký: tối đa 20 request / 15 phút / IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});

// --- ROUTE CÔNG KHAI ---
app.post('/api/login', authLimiter, authController.login);
app.post('/api/register', authLimiter, authController.register);
app.post('/api/change-password', verifyToken, authController.changePassword);

// --- ROUTE BẢO VỆ ---
app.use('/api/news', verifyToken, newsRoutes);
app.use('/api/file', verifyToken, fileRoutes);
app.use('/api/drive', verifyToken, driveRoutes);
app.use('/api/push', verifyToken, pushRoutes);
app.use('/api/errors', verifyToken, isAdmin, errorLogRoutes);
app.use('/api/chat', verifyToken, chatRoutes);


// Lấy danh sách user cơ bản
app.get('/api/users/basic', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT UserID, FullName FROM dbo.Users');
        res.json(result.recordset);
    } catch (err) {
        logError({ source: 'server./api/users/basic', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
});

// --- ROUTE ADMIN ---
app.get('/api/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        // ✅ FIX: Thêm Age vào query để trả đủ thông tin
        const result = await pool.request()
            .query('SELECT UserID, Username, FullName, Role, RoleID, Department, Age FROM dbo.Users');
        res.json(result.recordset);
    } catch (err) {
        logError({ source: 'server./api/users', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:userId/role', verifyToken, isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    try {
        const pool = await poolPromise;
        // ✅ roleIdMap đồng bộ với Role insert khi register
        const roleIdMap = {
            "CTV": 1,
            "Người duyệt": 2,
            "Trưởng ban": 3,
            "Admin": 4,
            "Thư ký": 5,
            "Kiểm soát viên": 6
        };
        const roleId = roleIdMap[role] || 1;
        await pool.request()
            .input('uid', userId)
            .input('r', role)
            .input('rid', roleId)
            .query('UPDATE dbo.Users SET Role = @r, RoleID = @rid WHERE UserID = @uid');
        res.json({ success: true, message: 'Cập nhật quyền thành công!' });
    } catch (err) {
        logError({ source: 'server./api/users/:userId/role', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:userId', verifyToken, isAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('uid', userId)
            .query('DELETE FROM dbo.Users WHERE UserID = @uid');
        res.json({ success: true, message: 'Đã xóa người dùng!' });
    } catch (err) {
        logError({ source: 'server./api/users/:userId DELETE', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
});

// Lưới an toàn: bắt các lỗi chưa được catch ở route/middleware nào khác
app.use((err, req, res, next) => {
    console.error('❌ [Unhandled]', err);
    logError({ source: 'server.unhandled', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Lỗi server không xác định' });
});

// Khởi chạy
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: true,
        methods: ['GET', 'POST']
    }
});
setIO(io);
initChatSocket(io);

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});