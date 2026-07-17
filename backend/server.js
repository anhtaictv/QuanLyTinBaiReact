const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { poolPromise } = require('./config/db');
const authController = require('./controllers/authController');
const newsRoutes = require('./routes/newsRoutes');
const fileRoutes = require('./routes/fileRoutes');
const { verifyToken, isAdmin } = require('./middleware/authMiddleware');
const {
    handleValidation, registerRules, loginRules, changePasswordRules,
    updateEmailRules, forgotPasswordRules, resetPasswordRules,
} = require('./middleware/validators');
const driveRoutes = require('./routes/driveRoutes'); // ✅ chỉ require ở đây
const pushRoutes = require('./routes/pushRoutes');
const errorLogRoutes = require('./routes/errorLogRoutes');
const chatRoutes = require('./routes/chatRoutes');
const newsDigestRoutes = require('./routes/newsDigestRoutes');
const { initChatSocket } = require('./sockets/chatSocket');
const { setIO } = require('./sockets/ioHolder');
const { logError } = require('./utils/errorLogger');

const app = express(); // ✅ khai báo app trước

// App chạy sau đúng 2 lớp reverse-proxy IIS nội bộ (qltb_proxy -> qltin-frontend), cả hai
// đều chạy trên cùng máy này. Nếu không khai báo, Express dùng thẳng socket IP (luôn là
// chặng proxy cuối) làm "IP người dùng" cho MỌI request — rate-limit chống brute-force khi
// đó vô tác dụng (tất cả mọi người tính chung 1 IP). Chỉ 2 vì Node giờ chỉ nhận traffic từ
// 127.0.0.1 (xem httpServer.listen bên dưới) — không có đường nào bỏ qua 2 chặng proxy này.
app.set('trust proxy', 2);

// IIS ARR ở đây ghi mỗi chặng X-Forwarded-For dạng "ip:port" thay vì chuẩn "ip" — chuẩn
// hoá lại trước khi Express/express-rate-limit đọc, nếu không việc lấy IP thật ở trên sẽ sai.
app.use((req, res, next) => {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        req.headers['x-forwarded-for'] = xff
            .split(',')
            .map(part => part.trim().replace(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/, '$1'))
            .join(', ');
    }
    next();
});

// Middleware
// API JSON thuần, không tự render HTML nào (frontend build riêng, serve qua IIS) nên
// contentSecurityPolicy mặc định gần như vô hại — vẫn giữ cho các header khác (nosniff,
// HSTS, tắt X-Powered-By...). Mở crossOriginResourcePolicy vì file (Word/PDF) tải qua
// /api/file có thể được truy cập same-site nhưng khác port lúc dev (Vite :3000 -> API :5001).
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint công khai cho dịch vụ uptime monitor bên ngoài (UptimeRobot, Better Uptime...) —
// không qua verifyToken (monitor không đăng nhập được) và đặt trước mọi rate limiter để
// không bao giờ tự bị chặn nhầm dù ping dồn dập. Check nhanh cả kết nối DB — nếu DB rớt,
// process Node vẫn sống nhưng app coi như hỏng, cần biết để phân biệt "server đơ" khỏi
// "chỉ DB đang trục trặc" khi xem cảnh báo bên ngoài.
app.get('/api/health', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
    } catch (err) {
        res.status(503).json({ status: 'degraded', db: 'disconnected', uptime: process.uptime() });
    }
});

// Chặn brute-force đăng nhập/đăng ký theo IP thật (xem trust proxy ở trên).
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});
// Chặn dồn dập trong thời gian ngắn (vd script thử hàng chục mật khẩu/giây) — cùng lúc
// với giới hạn 15 phút ở trên, không thay thế.
const authBurstLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 4,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});

// Giới hạn chung cho toàn bộ /api — trước đây chỉ /api/login và /api/register có rate
// limit, các endpoint khác (gửi bài, upload file, chat...) không bị chặn nếu bị spam/dò
// quét tự động. Ngưỡng đủ rộng để nhiều người cùng cơ quan dùng chung 1 IP văn phòng vẫn
// thoải mái (ErrorBell tự poll mỗi 30s, vài chục người dùng cùng lúc), chỉ chặn hành vi
// bất thường (script gọi liên tục).
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});
app.use('/api', apiLimiter);

// --- ROUTE CÔNG KHAI ---
app.post('/api/login', authBurstLimiter, authLimiter, loginRules, handleValidation, authController.login);
app.post('/api/register', authBurstLimiter, authLimiter, registerRules, handleValidation, authController.register);
app.post('/api/change-password', verifyToken, changePasswordRules, handleValidation, authController.changePassword);
app.post('/api/refresh-token', verifyToken, authController.refreshToken);
app.get('/api/profile/email', verifyToken, authController.getMyEmail);
app.put('/api/profile/email', verifyToken, updateEmailRules, handleValidation, authController.updateMyEmail);
app.post('/api/forgot-password', authBurstLimiter, authLimiter, forgotPasswordRules, handleValidation, authController.forgotPassword);
app.post('/api/reset-password', authBurstLimiter, authLimiter, resetPasswordRules, handleValidation, authController.resetPassword);

// --- ROUTE BẢO VỆ ---
app.use('/api/news', verifyToken, newsRoutes);
app.use('/api/file', verifyToken, fileRoutes);
app.use('/api/drive', verifyToken, driveRoutes);
app.use('/api/push', verifyToken, pushRoutes);
app.use('/api/errors', verifyToken, isAdmin, errorLogRoutes);
app.use('/api/chat', verifyToken, chatRoutes);
app.use('/api/news-digest', verifyToken, newsDigestRoutes);


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
        if (!Object.prototype.hasOwnProperty.call(roleIdMap, role)) {
            return res.status(400).json({ error: 'Vai trò không hợp lệ!' });
        }
        const roleId = roleIdMap[role];
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
// Chỉ lắng nghe ở loopback — Node trước đây bind 0.0.0.0 nên bị gọi thẳng từ Internet,
// bỏ qua toàn bộ lớp reverse-proxy IIS phía trước (và có thể giả mạo X-Forwarded-For để
// né rate-limit chống brute-force). Mọi traffic hợp lệ đều đi qua IIS proxy trên cùng máy.
httpServer.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Server đang chạy tại port ${PORT} (chỉ 127.0.0.1)`);
});