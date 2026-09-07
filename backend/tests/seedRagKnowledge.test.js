const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Không import trực tiếp scripts/seed-rag-knowledge.js vì nó tự chạy IIFE gọi AI Gateway
// (embed) ngay khi require — đọc source rồi trích DOCS ra để kiểm tra tĩnh, không thực thi.
const src = fs.readFileSync(path.join(__dirname, '../scripts/seed-rag-knowledge.js'), 'utf8');

function extractDocs() {
    // DOCS tham chiếu DAKLAK_WARDS (nội dung địa danh) — phải khai báo cả hai cùng scope.
    const wardsMatch = src.match(/const DAKLAK_WARDS = \[[\s\S]*?\];/);
    const docsMatch = src.match(/const DOCS = (\[[\s\S]*?\n\]);/);
    assert.ok(wardsMatch && docsMatch, 'Không tìm thấy khai báo DAKLAK_WARDS/DOCS trong seed-rag-knowledge.js');
    return Function(`${wardsMatch[0]}\nreturn ${docsMatch[1]};`)();
}

test('seed-rag-knowledge DOCS: mỗi tài liệu có sourceId/title/content không rỗng', () => {
    const docs = extractDocs();
    assert.ok(docs.length > 0);
    for (const doc of docs) {
        assert.ok(doc.sourceId && doc.sourceId.trim(), `Thiếu sourceId: ${JSON.stringify(doc).slice(0, 80)}`);
        assert.ok(doc.title && doc.title.trim(), `Thiếu title cho sourceId=${doc.sourceId}`);
        assert.ok(doc.content && doc.content.trim().length > 20, `Content quá ngắn/rỗng cho sourceId=${doc.sourceId}`);
    }
});

test('seed-rag-knowledge DOCS: sourceId không trùng nhau (tránh xóa nhầm/ghi đè chéo)', () => {
    const docs = extractDocs();
    const ids = docs.map(d => d.sourceId);
    assert.equal(new Set(ids).size, ids.length);
});

test('seed-rag-knowledge: danh sách DAKLAK_WARDS có đúng 102 xã/phường khớp newsDigestFetcher.js', () => {
    const wardsMatch = src.match(/const DAKLAK_WARDS = (\[[\s\S]*?\]);/);
    const wards = Function('return ' + wardsMatch[1])();

    const fetcherSrc = fs.readFileSync(path.join(__dirname, '../utils/newsDigestFetcher.js'), 'utf8');
    const fetcherWardsMatch = fetcherSrc.match(/const DAKLAK_WARDS = (\[[\s\S]*?\]);/);
    const fetcherWards = Function('return ' + fetcherWardsMatch[1])();

    assert.equal(wards.length, 102);
    assert.deepEqual(wards, fetcherWards);
});
