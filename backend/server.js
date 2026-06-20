const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { poolPromise } = require('./config/db');
const authController = require('./controllers/authController');
const newsRoutes = require('./routes/newsRoutes');
const fileRoutes = require('./routes/fileRoutes');
const { verifyToken, isAdmin } = require('./middleware/authMiddleware');
const driveRoutes = require('./routes/driveRoutes'); // ✅ chỉ require ở đây
const pushRoutes = require('./routes/pushRoutes');

const app = express(); // ✅ khai báo app trước

// Middleware
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ROUTE CÔNG KHAI ---
app.post('/api/login', authController.login);
app.post('/api/register', authController.register);
app.post('/api/change-password', verifyToken, authController.changePassword);

// --- ROUTE BẢO VỆ ---
app.use('/api/news', verifyToken, newsRoutes);
app.use('/api/file', verifyToken, fileRoutes);
app.use('/api/drive', verifyToken, driveRoutes);
app.use('/api/push', verifyToken, pushRoutes);


// Lấy danh sách user cơ bản
app.get('/api/users/basic', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT UserID, FullName FROM dbo.Users');
        res.json(result.recordset);
    } catch (err) {
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
        res.status(500).json({ error: err.message });
    }
});

// Khởi chạy
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});