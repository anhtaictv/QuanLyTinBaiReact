// Tổng hợp tin từ RSS báo chí, lọc theo địa bàn Đắk Lắk, lưu vào DB — chạy qua Windows
// Task Scheduler định kỳ vài giờ/lần (SQL Server Express không có SQL Agent nên không lập
// job được ngay trong SQL Server, cùng lý do với scripts/daily-backup.js).
const { runDigestFetch } = require('../utils/newsDigestFetcher');
const { logError } = require('../utils/errorLogger');

(async () => {
    try {
        console.log('Đang tổng hợp tin từ RSS...');
        const { matched, inserted, sourceErrors } = await runDigestFetch();
        console.log(`✅ Xong: khớp ${matched} bài, thêm mới ${inserted} bài.`);
        if (sourceErrors.length) {
            console.warn('⚠️ Một số nguồn lỗi:', sourceErrors.map(e => `${e.source}: ${e.message}`).join(' | '));
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Tổng hợp tin thất bại:', err.message);
        await logError({ source: 'scripts.fetch-news-digest', message: err.message, stack: err.stack });
        process.exit(1);
    }
})();
