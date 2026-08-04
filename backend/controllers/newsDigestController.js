const { poolPromise } = require('../config/db');
const { runDigestFetch } = require('../utils/newsDigestFetcher');
const { logError } = require('../utils/errorLogger');

// Danh sách tin đã tổng hợp — mới nhất trước.
exports.getDigest = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT TOP 200 ItemID, Title, Link, SourceName, Summary, Keyword, PublishedAt, FetchedAt
            FROM dbo.NewsDigestItems
            ORDER BY COALESCE(PublishedAt, FetchedAt) DESC
        `);

        const lastFetchResult = await pool.request().query(`
            SELECT MAX(FetchedAt) AS LastFetchedAt FROM dbo.NewsDigestItems
        `);

        res.json({
            items: result.recordset || [],
            lastFetchedAt: lastFetchResult.recordset?.[0]?.LastFetchedAt || null,
        });
    } catch (err) {
        logError({ source: 'newsDigestController.getDigest', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// Kích hoạt fetch RSS ngay lập tức (thay vì chờ Task Scheduler định kỳ) — dành cho Admin/Trưởng
// ban/Thư ký dùng khi cần tin mới gấp hoặc lúc mới cài đặt để kiểm tra nguồn hoạt động tốt chưa.
exports.refreshNow = async (req, res) => {
    try {
        const { matched, inserted, sourceErrors } = await runDigestFetch();
        res.json({ success: true, matched, inserted, sourceErrors });
    } catch (err) {
        logError({ source: 'newsDigestController.refreshNow', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};
