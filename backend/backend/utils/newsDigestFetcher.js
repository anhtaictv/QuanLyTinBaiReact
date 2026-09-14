// Gom tin từ tìm kiếm Google Tin tức, lọc lấy tin liên quan tới địa bàn Đắk Lắk, lưu vào
// dbo.NewsDigestItems. Dùng chung bởi scripts/fetch-news-digest.js (chạy định kỳ qua Windows
// Task Scheduler) và controllers/newsDigestController.js (nút "Cập nhật ngay" của Admin).
//
// Trước có thêm RSS chuyên mục của VnExpress/Dân Trí/Tuổi Trẻ/Báo Tin Tức (chưa báo nào ở
// Đắk Lắk tự cấp RSS theo tỉnh) nhưng đã bỏ, chỉ giữ Google Tin tức (news.google.com/rss/search)
// với từ khoá Đắk Lắk/Buôn Ma Thuột — gom được cả báo/đài nhỏ, không phải cào HTML dễ vỡ.
// Khi nào tòa soạn có link RSS riêng của báo/đài địa phương, chỉ cần thêm vào SOURCES.
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

// 102 xã/phường của tỉnh Đắk Lắk (mới, sau sáp nhập với Phú Yên) — hiệu lực 01/07/2025 theo
// Nghị quyết 1660/NQ-UBTVQH15. Chỉ tìm theo "Đắk Lắk"/"Buôn Ma Thuột" bỏ sót tin chỉ nêu tên
// xã/phường cụ thể (nhất là tin thời sự địa phương ngắn) mà không nhắc lại tên tỉnh.
const DAKLAK_WARDS = [
    'Hòa Phú', 'Ea Drông', 'Ea Súp', 'Ea Rốk', 'Ea Bung', 'Ea Wer', 'Ea Nuôl', 'Ea Kiết',
    "Ea M'Droh", 'Quảng Phú', 'Cuôr Đăng', "Cư M'gar", 'Ea Tul', 'Pơng Drang', 'Krông Búk',
    'Cư Pơng', 'Ea Khăl', 'Ea Drăng', 'Ea Wy', 'Ea Hiao', 'Krông Năng', 'Dliê Ya', 'Tam Giang',
    'Phú Xuân', 'Krông Pắc', 'Ea Knuếc', 'Tân Tiến', 'Ea Phê', 'Ea Kly', 'Ea Kar', 'Ea Ô',
    'Ea Knốp', 'Cư Yang', 'Ea Păl', "M'Drắk", 'Ea Riêng', "Cư M'ta", 'Krông Á', 'Cư Prao',
    'Hòa Sơn', 'Dang Kang', 'Krông Bông', 'Yang Mao', 'Cư Pui', 'Liên Sơn Lắk', 'Đắk Liêng',
    'Nam Ka', 'Đắk Phơi', 'Ea Ning', 'Dray Bhăng', 'Ea Ktur', 'Krông Ana', 'Dur Kmăl', 'Ea Na',
    'Xuân Thọ', 'Xuân Cảnh', 'Xuân Lộc', 'Hòa Xuân', 'Tuy An Bắc', 'Tuy An Đông', 'Ô Loan',
    'Tuy An Nam', 'Tuy An Tây', 'Phú Hòa 1', 'Phú Hòa 2', 'Tây Hòa', 'Hòa Thịnh', 'Hòa Mỹ',
    'Sơn Thành', 'Sơn Hòa', 'Vân Hòa', 'Tây Sơn', 'Suối Trai', 'Ea Ly', 'Ea Bá', 'Đức Bình',
    'Sông Hinh', 'Xuân Lãnh', 'Phú Mỡ', 'Xuân Phước', 'Đồng Xuân', 'Buôn Đôn', "Ea H'Leo",
    'Ea Trang', 'Ia Lốp', 'Ia Rvê', 'Krông Nô', 'Vụ Bổn',
    // 14 phường
    'Buôn Ma Thuột', 'Tân An', 'Tân Lập', 'Thành Nhất', 'Ea Kao', 'Buôn Hồ', 'Cư Bao',
    'Phú Yên', 'Tuy Hòa', 'Bình Kiến', 'Xuân Đài', 'Sông Cầu', 'Đông Hòa', 'Hòa Hiệp',
];

// ponytail: OR thẳng theo từng tên xã/phường — vài tên (Quảng Phú, Tân An, Sông Cầu...) trùng
// tên đơn vị hành chính ở tỉnh khác nên lâu lâu lẫn vài tin không liên quan (đã thực đo ~8%
// trên 100 kết quả mẫu). Chấp nhận được vì trang này tự ghi rõ "chưa qua kiểm duyệt biên tập,
// chỉ tham khảo nhanh" — biên tập viên tự lọc trước khi dùng thật. Muốn giảm nhiễu: đổi sang
// AND theo cặp (tên xã + 1 từ khoá vùng khác như "Tây Nguyên") cho riêng các tên dễ trùng.
const GOOGLE_NEWS_QUERY = '"Đắk Lắk" OR ' + DAKLAK_WARDS.map(w => `"${w}"`).join(' OR ');

const SOURCES = [
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

        // RSS đôi khi cho pubDate/isoDate dạng không parse được -> new Date() ra Invalid Date,
        // driver mssql lỗi khi bind sql.DateTime với giá trị đó. Trước đây lỗi này không khớp
        // regex trùng-khóa bên dưới nên bị throw giữa loop, làm mất luôn các bài HỢP LỆ còn lại
        // trong cùng lượt fetch. Validate trước, coi ngày hỏng như "không có" thay vì để insert lỗi.
        const publishedAt = it.publishedAt ? new Date(it.publishedAt) : null;
        const validPublishedAt = publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null;

        try {
            await pool.request()
                .input('Title', sql.NVarChar(500), it.title.slice(0, 500))
                .input('Link', sql.NVarChar(1000), it.link)
                .input('SourceName', sql.NVarChar(200), it.sourceName)
                .input('Summary', sql.NVarChar(sql.MAX), it.summary)
                .input('Keyword', sql.NVarChar(100), it.keyword)
                .input('PublishedAt', sql.DateTime, validPublishedAt)
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
