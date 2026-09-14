// Cập nhật định kỳ hồ sơ văn phong của mọi người có đủ bài đã duyệt — chạy qua Windows
// Task Scheduler (cùng lý do với scripts/daily-backup.js và scripts/fetch-news-digest.js:
// SQL Server Express không có SQL Agent). Đề xuất lịch chạy 1 lần/tuần: văn phong một
// người không đổi đủ nhanh để cần chạy dày hơn, và mỗi lượt tốn 1 lệnh gọi AI Gateway/người.
const { refreshAllStyleProfiles } = require('../utils/styleProfileBuilder');
const { logError } = require('../utils/errorLogger');

(async () => {
    try {
        console.log('Đang cập nhật hồ sơ văn phong...');
        const { total, updated, errors } = await refreshAllStyleProfiles();
        console.log(`✅ Xong: ${updated}/${total} người được cập nhật.`);
        if (errors.length) {
            console.warn('⚠️ Một số người lỗi:', errors.map(e => `UserID ${e.userId}: ${e.message}`).join(' | '));
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Cập nhật hồ sơ văn phong thất bại:', err.message);
        await logError({ source: 'scripts.update-style-profiles', message: err.message, stack: err.stack });
        process.exit(1);
    }
})();
