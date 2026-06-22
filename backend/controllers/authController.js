const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logError } = require('../utils/errorLogger');

const SECRET_KEY = process.env.JWT_SECRET;

// ================= REGISTER =================
exports.register = async (req, res) => { 
    const { Username, Password, FullName, Age, Department } = req.body; 

    try {
        if (!Username || !Password || !FullName) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc!'
            });
        }

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
            .query(`
                INSERT INTO dbo.Users 
                (Username, PasswordHash, FullName, RoleID, Role, Age, Department) 
                VALUES (@u, @hp, @fn, 1, 'CTV', @age, @dept)
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
        if (!Username || !Password) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu Username hoặc Password!'
            });
        }

        const pool = await poolPromise; 

        const result = await pool.request()
            .input('u', Username)
            .query(`
                SELECT UserID, FullName, Username, PasswordHash, Role 
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
            return res.status(401).json({ 
                success: false, 
                message: 'Sai mật khẩu!' 
            }); 
        }

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
        if (!OldPassword || !NewPassword) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin!' });
        }

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