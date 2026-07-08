const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logError } = require('../utils/errorLogger');
const { sendResetPasswordEmail } = require('../utils/mailer');

const SECRET_KEY = process.env.JWT_SECRET;

// Khoá tạm 1 tài khoản sau nhiều lần đăng nhập sai — chặn kiểu tấn công dùng nhiều IP
// khác nhau (botnet) nhắm vào 1 tài khoản, thứ mà rate-limit theo IP ở server.js không
// chặn được. Lưu trong bộ nhớ (đủ dùng cho 1 tiến trình; nếu restart thì đếm lại từ đầu).
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLoginTracker = new Map(); // username (lowercase) -> { count, lockedUntil }

function getLockoutRemainingMs(username) {
    const entry = failedLoginTracker.get(username.toLowerCase());
    if (!entry || !entry.lockedUntil) return 0;
    return Math.max(0, entry.lockedUntil - Date.now());
}

function registerFailedLogin(username) {
    const key = username.toLowerCase();
    const entry = failedLoginTracker.get(key) || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOCKOUT_MS;
        entry.count = 0;
    }
    failedLoginTracker.set(key, entry);
}

function clearFailedLogins(username) {
    failedLoginTracker.delete(username.toLowerCase());
}

// ================= REGISTER =================
exports.register = async (req, res) => {
    const { Username, Password, FullName, Age, Department, Email } = req.body;

    try {
        const pool = await poolPromise;
        
        const check = await pool.request()
            .input('u', Username)
            .query('SELECT Username FROM dbo.Users WHERE Username = @u'); 
            
        if (check.recordset.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập đã tồn tại!' 
            }); 
        }

        const hashedPass = await bcrypt.hash(Password, 10);
        const ageValue = Number.isInteger(Number(Age)) ? Number(Age) : null;

        // ✅ FIX: RoleID=1, Role='CTV' (đúng với roleIdMap)
        await pool.request()
            .input('u', Username)
            .input('hp', hashedPass)
            .input('fn', FullName)
            .input('age', ageValue)
            .input('dept', Department || null)
            .input('email', Email || null)
            .query(`
                INSERT INTO dbo.Users
                (Username, PasswordHash, FullName, RoleID, Role, Age, Department, Email)
                VALUES (@u, @hp, @fn, 1, 'CTV', @age, @dept, @email)
            `);

        res.json({ success: true, message: 'Đăng ký thành công!' }); 

    } catch (err) {
        console.error("Lỗi đăng ký FULL:", err);
        logError({ source: 'authController.register', message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ================= LOGIN =================
exports.login = async (req, res) => { 
    const { Username, Password } = req.body;

    try {
        const lockoutRemainingMs = getLockoutRemainingMs(Username);
        if (lockoutRemainingMs > 0) {
            return res.status(429).json({
                success: false,
                message: `Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${Math.ceil(lockoutRemainingMs / 60000)} phút.`
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('u', Username)
            .query(`
                SELECT UserID, FullName, Username, PasswordHash, Role, Email
                FROM dbo.Users
                WHERE Username = @u
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại!'
            });
        }

        const isMatch = await bcrypt.compare(Password, user.PasswordHash);

        if (!isMatch) {
            registerFailedLogin(Username);
            return res.status(401).json({
                success: false,
                message: 'Sai mật khẩu!'
            });
        }

        clearFailedLogins(Username);

        const token = jwt.sign(
            { UserID: user.UserID, Role: user.Role }, 
            SECRET_KEY, 
            { expiresIn: '24h' }
        );

        delete user.PasswordHash;

        res.json({ 
            success: true, 
            token, 
            user 
        });

    } catch (err) {
        console.error("Lỗi login:", err);
        logError({ source: 'authController.login', message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
// ================= ĐỔI MK =================
exports.changePassword = async (req, res) => {
    const { OldPassword, NewPassword } = req.body;
    const userID = req.user.UserID;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', userID)
            .query('SELECT PasswordHash FROM dbo.Users WHERE UserID = @uid');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy user!' });

        const isMatch = await bcrypt.compare(OldPassword, user.PasswordHash);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Mật khẩu cũ không đúng!' });

        const hashedNew = await bcrypt.hash(NewPassword, 10);
        await pool.request()
            .input('uid', userID)
            .input('hp', hashedNew)
            .query('UPDATE dbo.Users SET PasswordHash = @hp WHERE UserID = @uid');

        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });

    } catch (err) {
        logError({ source: 'authController.changePassword', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= EMAIL (dùng cho "Quên mật khẩu") =================
// Users tạo trước khi có tính năng này chưa có Email — cho phép tự cập nhật ở trang
// Đổi mật khẩu, không cần đợi Admin. Bắt buộc phải có Email mới dùng được luồng quên
// mật khẩu (forgotPassword chỉ khớp khi cả Username lẫn Email đều đúng).
exports.getMyEmail = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', req.user.UserID)
            .query('SELECT Email FROM dbo.Users WHERE UserID = @uid');
        res.json({ success: true, email: result.recordset[0]?.Email || '' });
    } catch (err) {
        logError({ source: 'authController.getMyEmail', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateMyEmail = async (req, res) => {
    const { Email } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('uid', req.user.UserID)
            .input('email', Email)
            .query('UPDATE dbo.Users SET Email = @email WHERE UserID = @uid');
        res.json({ success: true, message: 'Cập nhật email thành công!' });
    } catch (err) {
        logError({ source: 'authController.updateMyEmail', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= REFRESH TOKEN =================
// Cấp token mới với hạn 24h mới, miễn là token hiện tại còn hạn (verifyToken đã chặn
// token hết hạn trước khi vào đây). Cho phép session của người đang thao tác tích cực
// (frontend tự gọi định kỳ) không bị văng ra giữa chừng khi token 24h cũ sắp hết hạn —
// không cần cơ chế refresh-token riêng phức tạp. Người dùng idle vẫn bị đăng xuất bởi
// useIdleLogout ở frontend (10 phút không thao tác) như trước giờ.
exports.refreshToken = async (req, res) => {
    const token = jwt.sign(
        { UserID: req.user.UserID, Role: req.user.Role },
        SECRET_KEY,
        { expiresIn: '24h' }
    );
    res.json({ success: true, token });
};

// ================= QUÊN MẬT KHẨU =================
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 phút

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Luôn trả cùng 1 thông báo chung dù tài khoản/email có khớp hay không — tránh lộ
// thông tin "tài khoản này có tồn tại không" cho kẻ dò quét (user enumeration).
const GENERIC_MESSAGE = 'Nếu thông tin khớp với 1 tài khoản đã có email, link đặt lại mật khẩu đã được gửi tới email đó.';

exports.forgotPassword = async (req, res) => {
    const { Username, Email } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('u', Username)
            .input('email', Email)
            .query(`
                SELECT UserID, Email FROM dbo.Users
                WHERE Username = @u AND Email IS NOT NULL AND LOWER(Email) = LOWER(@email)
            `);

        const user = result.recordset[0];

        // Không khớp -> vẫn trả 200 thông báo chung, không tiết lộ lý do cụ thể.
        if (!user) {
            return res.json({ success: true, message: GENERIC_MESSAGE });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await pool.request()
            .input('uid', user.UserID)
            .input('hash', tokenHash)
            .input('exp', expiresAt)
            .query(`
                INSERT INTO dbo.PasswordResetTokens (UserID, TokenHash, ExpiresAt)
                VALUES (@uid, @hash, @exp)
            `);

        const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
        const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

        try {
            await sendResetPasswordEmail(user.Email, resetUrl);
        } catch (mailErr) {
            // Lỗi gửi mail không được lộ ra cho client (vẫn trả thông báo chung) — chỉ
            // ghi log để Admin biết qua ErrorBell/Telegram (vd SMTP cấu hình sai).
            logError({ source: 'authController.forgotPassword.sendMail', message: mailErr.message, stack: mailErr.stack });
        }

        res.json({ success: true, message: GENERIC_MESSAGE });

    } catch (err) {
        logError({ source: 'authController.forgotPassword', message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const pool = await poolPromise;
        const tokenHash = hashToken(token);

        // ExpiresAt được ghi từ Node (new Date(...), luôn là UTC) nên phải so sánh với
        // GETUTCDATE() chứ không phải GETDATE() (giờ local server, UTC+7) — nếu dùng
        // GETDATE() thì mọi token bị coi là hết hạn ngay lúc tạo ra (lệch 7 tiếng).
        const result = await pool.request()
            .input('hash', tokenHash)
            .query(`
                SELECT ResetID, UserID FROM dbo.PasswordResetTokens
                WHERE TokenHash = @hash AND Used = 0 AND ExpiresAt > GETUTCDATE()
            `);

        const resetRow = result.recordset[0];
        if (!resetRow) {
            return res.status(400).json({ success: false, message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn!' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input('uid', resetRow.UserID)
            .input('hp', hashedNew)
            .query('UPDATE dbo.Users SET PasswordHash = @hp WHERE UserID = @uid');

        await pool.request()
            .input('id', resetRow.ResetID)
            .query('UPDATE dbo.PasswordResetTokens SET Used = 1 WHERE ResetID = @id');

        res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });

    } catch (err) {
        logError({ source: 'authController.resetPassword', message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};