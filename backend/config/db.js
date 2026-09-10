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
    port: 1433,
    // VPS 4GB chay 2 instance SQL + Node + IIS 8 site: OS ep SQL Server co buffer cache
    // xuong ~210MB du max server memory la 1024MB, PLE tut con 76s (do that 10/09/2026),
    // nen query vao bang vai dong van phai doc dia. Tran mac dinh 15s cua mssql bi vuot
    // hang loat -> /api/tasks, /api/chat, /api/news-digest cung chet "in 15000ms".
    // Noi tran de request cho duoc thay vi hong han; day la cam cu, goc re van la thieu RAM.
    requestTimeout: 60000,
    // Lan connect dau do duoc mat 21s (that bai o 15s roi retry) -> tran connect cung phai noi,
    // khong thi connectWithRetry quay vong vo ich trong luc SQL chi dang cham chu chua chet.
    connectionTimeout: 30000,
    pool: {
        max: 10, // giu nguyen mac dinh: bom them ket noi vao mot SQL dang doi RAM chi lam te hon
        min: 0,
        idleTimeoutMillis: 30000,
        // Cho lay ket noi tu pool phai du lau de khop voi requestTimeout o tren, neu khong
        // request xep hang se hong som hon ca query that su dang chay.
        acquireTimeoutMillis: 60000
    }
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
