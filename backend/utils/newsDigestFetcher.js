// Gom tin từ RSS các báo lớn, lọc lấy tin liên quan tới địa bàn Đắk Lắk, lưu vào
// dbo.NewsDigestItems. Dùng chung bởi scripts/fetch-news-digest.js (chạy định kỳ qua
// Windows Task Scheduler) và controllers/newsDigestController.js (nút "Cập nhật ngay" của Admin).
//
// Chưa có báo nào ở Đắk Lắk tự cấp RSS theo tỉnh (baodaklak.vn không có RSS, VnExpress/Dân
// Trí/Tuổi Trẻ chỉ chia RSS theo chuyên mục, không theo tỉnh) — nên lấy các chuyên mục có khả
// năng liên quan (thời sự, pháp luật, đời sống, địa phương) từ báo lớn rồi lọc theo từ khoá
// địa danh. Khi nào tòa soạn có link RSS riêng của báo/đài địa phương, chỉ cần thêm vào SOURCES.
const Parser = require('rss-parser');
const { poolPromise, sql } = require('../config/db');

const parser = new Parser({ timeout: 15000 });

const SOURCES = [
    { name: 'VnExpress - Thời sự',        url: 'https://vnexpress.net/rss/thoi-su.rss' },
    { name: 'VnExpress - Pháp luật',      url: 'https://vnexpress.net/rss/phap-luat.rss' },
    { name: 'VnExpress - Đời sống',       url: 'https://vnexpress.net/rss/gia-dinh.rss' },
    { name: 'Dân Trí - Thời sự',          url: 'https://dantri.com.vn/rss/thoi-su.rss' },
    { name: 'Dân Trí - Pháp luật',        url: 'https://dantri.com.vn/rss/phap-luat.rss' },
    { name: 'Dân Trí - Đời sống',         url: 'https://dantri.com.vn/rss/doi-song.rss' },
    { name: 'Tuổi Trẻ - Thời sự',         url: 'https://tuoitre.vn/thoi-su.rss' },
    { name: 'Tuổi Trẻ - Pháp luật',       url: 'https://tuoitre.vn/phap-luat.rss' },
    { name: 'Tuổi Trẻ - Bạn đọc',         url: 'https://tuoitre.vn/ban-doc.rss' },
    { name: 'Báo Tin Tức (TTXVN) - Địa phương', url: 'https://baotintuc.vn/dia-phuong.rss' },
];

// So khớp không phân biệt hoa/thường và có dấu/không dấu (RSS đôi khi gõ "Dak Lak" không dấu).
const KEYWORDS = ['đắk lắk', 'dak lak', 'buôn ma thuột', 'buon ma thuot'];

function stripDiacritics(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
}

function matchKeyword(text) {
    const normalized = stripDiacritics((text || '').toLowerCase());
    for (const kw of KEYWORDS) {
        if (normalized.includes(stripDiacritics(kw))) return kw;
    }
    return null;
}

async function fetchOneSource(source) {
    const feed = await parser.parseURL(source.url);
    const matched = [];
    for (const item of feed.items || []) {
        const haystack = `${item.title || ''} ${item.contentSnippet || item.summary || ''}`;
        const keyword = matchKeyword(haystack);
        if (!keyword) continue;
        matched.push({
            title: item.title || '(Không tiêu đề)',
            link: item.link,
            sourceName: source.name,
            summary: (item.contentSnippet || item.summary || '').slice(0, 2000),
            keyword,
            publishedAt: item.isoDate || item.pubDate || null,
        });
    }
    return matched;
}

// Chạy tuần tự từng nguồn (không Promise.all) — 1 RSS chậm/timeout không cần chặn các nguồn
// khác, và log lỗi rõ theo từng nguồn thay vì 1 lỗi tổng hợp mất dấu vết nguồn nào hỏng.
async function fetchAllSources() {
    const results = [];
    const errors = [];
    for (const source of SOURCES) {
        try {
            const items = await fetchOneSource(source);
            results.push(...items);
        } catch (err) {
            errors.push({ source: source.name, message: err.message });
        }
    }
    return { items: results, errors };
}

// Ghi từng bài, bỏ qua nếu đã tồn tại (dựa trên unique index UX_NewsDigestItems_LinkHash) —
// tránh phải SELECT trước để check tồn tại, để SQL Server tự xử lý qua lỗi trùng khoá.
async function saveItems(items) {
    const pool = await poolPromise;
    let inserted = 0;
    for (const it of items) {
        try {
            await pool.request()
                .input('Title', sql.NVarChar(500), it.title.slice(0, 500))
                .input('Link', sql.NVarChar(1000), it.link)
                .input('SourceName', sql.NVarChar(200), it.sourceName)
                .input('Summary', sql.NVarChar(sql.MAX), it.summary)
                .input('Keyword', sql.NVarChar(100), it.keyword)
                .input('PublishedAt', sql.DateTime, it.publishedAt ? new Date(it.publishedAt) : null)
                .query(`
                    INSERT INTO dbo.NewsDigestItems (Title, Link, SourceName, Summary, Keyword, PublishedAt)
                    VALUES (@Title, @Link, @SourceName, @Summary, @Keyword, @PublishedAt)
                `);
            inserted++;
        } catch (err) {
            // Lỗi trùng khoá (đã có bài này rồi) là chuyện bình thường mỗi lần chạy lại — bỏ qua.
            // Lỗi khác (mất kết nối DB...) thì cho nổi lên để script/route gọi biết mà xử lý.
            if (!/violat|duplicate|unique/i.test(err.message)) throw err;
        }
    }
    return inserted;
}

// Hàm chính: fetch toàn bộ nguồn, lọc theo từ khoá, lưu bài mới, trả về thống kê.
async function runDigestFetch() {
    const { items, errors } = await fetchAllSources();
    const inserted = await saveItems(items);
    return { matched: items.length, inserted, sourceErrors: errors };
}

module.exports = { runDigestFetch, SOURCES, KEYWORDS };
