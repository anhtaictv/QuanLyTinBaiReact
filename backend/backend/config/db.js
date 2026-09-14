const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: 'QuanLyTinBai',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    port: 1433
};

// Không dùng process.exit(1) khi mất kết nối DB — một trục trặc DB thoáng qua (SQL Server
// bận, mạng giật) trước đây làm SẬP TOÀN BỘ server (kể cả socket.io, route không liên quan
// DB), rồi PM2 restart, và nếu SQL vẫn chưa sẵn sàng thì lặp lại thành vòng lặp crash liên
// tục — downtime nặng hơn hẳn bản thân sự cố DB. Giờ: thử lại có backoff, KHÔNG thoát process;
// trong lúc chưa kết nối được, các request cần DB chỉ chờ/lỗi 500 thay vì cả server biến mất.
async function connectWithRetry(retryDelayMs = 5000) {
    while (true) {
        try {
            const pool = await new sql.ConnectionPool(config).connect();
            console.log(`✅ Connected to SQL Server (${config.server})`);
            // ConnectionPool là EventEmitter — 'error' không có listener sẽ ném lỗi
            // chưa bắt và crash cả process. Bắt lại đây để lỗi kết nối nền chỉ log,
            // không kéo sập server.
            pool.on('error', err => {
                console.error('❌ Lỗi pool SQL (đã bắt, server vẫn chạy tiếp): ', err.message);
            });
            return pool;
        } catch (err) {
            console.error(`❌ Kết nối DB thất bại, thử lại sau ${retryDelayMs / 1000}s: `, err.message);
            await new Promise(r => setTimeout(r, retryDelayMs));
        }
    }
}

const poolPromise = connectWithRetry();

module.exports = { sql, poolPromise };
