// Gom tin từ RSS các báo lớn + tìm kiếm Google Tin tức, lọc lấy tin liên quan tới địa bàn
// Đắk Lắk, lưu vào dbo.NewsDigestItems. Dùng chung bởi scripts/fetch-news-digest.js (chạy
// định kỳ qua Windows Task Scheduler) và controllers/newsDigestController.js (nút "Cập nhật
// ngay" của Admin).
//
// Chưa có báo nào ở Đắk Lắk tự cấp RSS theo tỉnh (baodaklak.vn không có RSS, VnExpress/Dân
// Trí/Tuổi Trẻ chỉ chia RSS theo chuyên mục, không theo tỉnh) — nên ngoài các chuyên mục có
// khả năng liên quan (thời sự, pháp luật, đời sống, địa phương) từ báo lớn, có thêm 1 nguồn
// "Google Tin tức" bằng RSS tìm kiếm chính thức của Google (news.google.com/rss/search) với
// từ khoá Đắk Lắk/Buôn Ma Thuột — gom được cả các báo/đài nhỏ hơn mà danh sách cứng dưới đây
// không có, mà không phải cào HTML trang kết quả tìm kiếm (dễ vỡ, có thể vi phạm điều khoản
// dùng của Google). Khi nào tòa soạn có link RSS riêng của báo/đài địa phương, chỉ cần thêm
// vào SOURCES.
const Parser = require('rss-parser');
const { poolPromise, sql } = require('../config/db');
const { KEYWORDS, matchKeyword, normalizeTitleForDedup, shortenSummary } = require('./newsDigestText');

const parser = new Parser({
    timeout: 15000,
    // Google News RSS gắn tên báo gốc vào tag <source> riêng (ngoài chuẩn RSS) — khai báo
    // customFields để rss-parser không bỏ qua, dùng để hiển thị "Google Tin tức - <báo gốc>"
    // thay vì chỉ ghi "Google Tin tức" chung.
    customFields: { item: [['source', 'sourceTag']] },
});

// Query tìm trên Google Tin tức — URL-encode ở nơi dùng (GOOGLE_NEWS_QUERY) vì có dấu + dấu ".
const GOOGLE_NEWS_QUERY = '"Đắk Lắk" OR "Buôn Ma Thuột"';

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
    {
        name: 'Google Tin tức',
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(GOOGLE_NEWS_QUERY)}&hl=vi&gl=VN&ceid=VN:vi`,
        isGoogleNews: true,
    },
];

async function fetchOneSource(source) {
    const feed = await parser.parseURL(source.url);
    const matched = [];
    for (const item of feed.items || []) {
        let title = item.title || '(Không tiêu đề)';
        let sourceName = source.name;

        if (source.isGoogleNews) {
            // <source> có thể parse ra string hoặc { _, $ } tuỳ có attribute hay không.
            const rawSource = typeof item.sourceTag === 'object' ? item.sourceTag?._ : item.sourceTag;
            if (rawSource) {
                sourceName = `Google Tin tức - ${rawSource}`;
                const suffix = ` - ${rawSource}`;
                if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
            }
        }

        const haystack = `${title} ${item.contentSnippet || item.summary || ''}`;
        // Nguồn Google Tin tức đã tự lọc theo GOOGLE_NEWS_QUERY nên tin trả về chắc chắn liên
        // quan — không loại nếu KEYWORDS không khớp y nguyên (vd chỉ nhắc tên xã/huyện cụ thể).
        const keyword = matchKeyword(haystack) || (source.isGoogleNews ? 'đắk lắk / buôn ma thuột (Google)' : null);
        if (!keyword) continue;

        matched.push({
            title,
            link: item.link,
            sourceName,
            summary: shortenSummary(item.contentSnippet || item.summary || ''),
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

// Ghi từng bài, bỏ qua nếu đã tồn tại. Hai lớp chống trùng:
//  1. Link giống hệt -> lỗi trùng khoá từ UX_NewsDigestItems_LinkHash (bắt qua catch, không
//     cần SELECT trước cho trường hợp phổ biến này).
//  2. Cùng tin nhưng Link khác (Google Tin tức trỏ qua link redirect riêng, hoặc báo đăng lại
//     nguyên văn từ nguồn khác) -> so theo NormTitle, check trước bằng 1 lần SELECT chung cho
//     cả batch (đỡ hơn N lần SELECT), cộng dồn luôn các NormTitle vừa thêm trong batch để 2 tin
//     trùng tới từ 2 nguồn khác nhau trong CÙNG 1 lần fetch cũng không lọt cả hai vào.
async function saveItems(items) {
    const pool = await poolPromise;

    const existing = await pool.request().query(`
        SELECT NormTitle FROM dbo.NewsDigestItems
        WHERE NormTitle IS NOT NULL AND FetchedAt >= DATEADD(day, -30, GETUTCDATE())
    `);
    const seenTitles = new Set((existing.recordset || []).map(r => r.NormTitle));

    let inserted = 0;
    for (const it of items) {
        const normTitle = normalizeTitleForDedup(it.title);
        if (normTitle && seenTitles.has(normTitle)) continue;

        try {
            await pool.request()
                .input('Title', sql.NVarChar(500), it.title.slice(0, 500))
                .input('Link', sql.NVarChar(1000), it.link)
                .input('SourceName', sql.NVarChar(200), it.sourceName)
                .input('Summary', sql.NVarChar(sql.MAX), it.summary)
                .input('Keyword', sql.NVarChar(100), it.keyword)
                .input('PublishedAt', sql.DateTime, it.publishedAt ? new Date(it.publishedAt) : null)
                .input('NormTitle', sql.NVarChar(500), normTitle.slice(0, 500))
                .query(`
                    INSERT INTO dbo.NewsDigestItems (Title, Link, SourceName, Summary, Keyword, PublishedAt, NormTitle)
                    VALUES (@Title, @Link, @SourceName, @Summary, @Keyword, @PublishedAt, @NormTitle)
                `);
            inserted++;
            seenTitles.add(normTitle);
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

module.exports = { runDigestFetch, SOURCES, KEYWORDS, normalizeTitleForDedup };
