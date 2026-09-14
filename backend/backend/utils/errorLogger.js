const https = require('https');
const { poolPromise } = require('../config/db');

// Báo lỗi qua Telegram bot ngay khi xảy ra, để Admin biết mà không cần tự mở app
// kiểm tra ErrorBell. Tuỳ chọn: chỉ gửi nếu đã cấu hình TELEGRAM_BOT_TOKEN +
// TELEGRAM_CHAT_ID trong .env, im lặng bỏ qua nếu chưa cấu hình. Best-effort,
// không throw — lỗi gửi Telegram không được làm sập request gốc.
function sendTelegramAlert({ source, message, userId, method, path }) {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const lines = [
        '🚨 Lỗi hệ thống QuanLyTinBai',
        `Nguồn: ${source || 'không rõ'}`,
        method && path ? `Request: ${method} ${path}` : null,
        userId ? `UserID: ${userId}` : null,
        `Chi tiết: ${String(message || 'Unknown error').slice(0, 500)}`
    ].filter(Boolean);

    const body = JSON.stringify({ chat_id: chatId, text: lines.join('\n') });

    const req = https.request(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 5000
        },
        (res) => { res.on('data', () => {}); } // xả buffer response, không cần đọc nội dung
    );
    req.on('error', (e) => console.warn('⚠️ [Telegram] Gửi cảnh báo thất bại:', e.message));
    req.on('timeout', () => req.destroy());
    req.write(body);
    req.end();
}

// Ghi lỗi vào dbo.ErrorLogs để Admin xem qua icon chuông báo lỗi.
// Cố ý "best effort": nếu ghi log thất bại thì chỉ console.warn, không throw,
// không được làm sập request gốc đang xử lý.
async function logError({ source, message, stack, userId, method, path }) {
    sendTelegramAlert({ source, message, userId, method, path });

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
