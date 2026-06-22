const { poolPromise } = require('../config/db');

// Ghi lỗi vào dbo.ErrorLogs để Admin xem qua icon chuông báo lỗi.
// Cố ý "best effort": nếu ghi log thất bại thì chỉ console.warn, không throw,
// không được làm sập request gốc đang xử lý.
async function logError({ source, message, stack, userId, method, path }) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('Source', source || null)
            .input('Message', String(message || 'Unknown error').slice(0, 4000))
            .input('StackTrace', stack ? String(stack).slice(0, 8000) : null)
            .input('UserID', userId || null)
            .input('Method', method || null)
            .input('Path', path || null)
            .query(`
                INSERT INTO dbo.ErrorLogs (Source, Message, StackTrace, UserID, Method, Path)
                VALUES (@Source, @Message, @StackTrace, @UserID, @Method, @Path)
            `);
    } catch (e) {
        console.warn('⚠️ [ErrorLogger] Không ghi được log lỗi:', e.message);
    }
}

module.exports = { logError };
