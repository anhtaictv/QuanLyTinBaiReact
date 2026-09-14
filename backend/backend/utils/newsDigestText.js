// Các hàm xử lý text thuần cho tổng hợp tin địa phương — tách riêng khỏi newsDigestFetcher.js
// (module đó require config/db.js, tự kết nối SQL Server ngay khi import) để test được mà
// không cần DB thật, và để dùng lại được ở nơi khác (vd script migration) không cần kéo theo DB.

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

// Chuẩn hoá tiêu đề để so trùng CHÉO NGUỒN — cùng 1 tin (vd báo đăng lại từ TTXVN, hoặc vừa
// khớp qua RSS chuyên mục vừa khớp qua Google Tin tức) sẽ có Link khác nhau nên unique index
// theo Link không bắt được, phải so theo tiêu đề đã bỏ dấu/hoa-thường/dấu câu.
function normalizeTitleForDedup(title) {
    return stripDiacritics((title || '').toLowerCase())
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripHtml(str) {
    return (str || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// Rút gọn tóm tắt về độ dài vừa đọc lướt trên danh sách (thay vì giữ nguyên đoạn trích RSS có
// khi vài nghìn ký tự, kèm rác HTML từ Google Tin tức) — cắt ở ranh giới từ, không cắt giữa từ.
function shortenSummary(raw, maxLen = 300) {
    const text = stripHtml(raw);
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

module.exports = { KEYWORDS, stripDiacritics, matchKeyword, normalizeTitleForDedup, stripHtml, shortenSummary };
