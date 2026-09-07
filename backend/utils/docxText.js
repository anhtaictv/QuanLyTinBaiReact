const PizZip = require('pizzip');

// Trích text thuần từ file .docx: unzip lấy word/document.xml rồi bóc tag XML. Đủ dùng để
// nạp nội dung bài viết vào RAG (fact-check) — không cần giữ định dạng, chỉ cần câu chữ.
function extractDocxText(buffer) {
    try {
        const zip = new PizZip(buffer);
        const xml = zip.file('word/document.xml')?.asText();
        if (!xml) return '';
        return xml
            .replace(/<w:p\b[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    } catch {
        return '';
    }
}

module.exports = { extractDocxText };
