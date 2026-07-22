const test = require('node:test');
const assert = require('node:assert/strict');
const { matchKeyword, normalizeTitleForDedup, shortenSummary } = require('../utils/newsDigestText');

test('matchKeyword: khớp có dấu và không dấu', () => {
    assert.equal(matchKeyword('Đắk Lắk mùa cà phê'), 'đắk lắk');
    // "Dak Lak" không dấu vẫn khớp (matchKeyword tự bỏ dấu trước khi so) — trả về entry đầu
    // tiên khớp trong KEYWORDS ('đắk lắk'), không phải bản không dấu của chính chuỗi nhập vào.
    assert.equal(matchKeyword('Dak Lak vao mua'), 'đắk lắk');
});

test('matchKeyword: không khớp nếu không nhắc tới địa danh', () => {
    assert.equal(matchKeyword('Hà Nội đón gió mùa'), null);
});

test('normalizeTitleForDedup: 2 tiêu đề cùng nội dung khác dấu/hoa-thường ra cùng 1 chuỗi', () => {
    const a = normalizeTitleForDedup('Đắk Lắk: Giá cà phê tăng mạnh!');
    const b = normalizeTitleForDedup('dak lak - gia ca phe tang manh');
    assert.equal(a, b);
});

test('normalizeTitleForDedup: 2 tiêu đề khác nội dung ra 2 chuỗi khác nhau', () => {
    const a = normalizeTitleForDedup('Đắk Lắk mùa cà phê');
    const b = normalizeTitleForDedup('Đắk Lắk mùa mưa lũ');
    assert.notEqual(a, b);
});

test('shortenSummary: giữ nguyên nếu ngắn hơn giới hạn', () => {
    assert.equal(shortenSummary('Tin ngắn.'), 'Tin ngắn.');
});

test('shortenSummary: cắt ở ranh giới từ, không cắt giữa từ, có dấu …', () => {
    const raw = 'a'.repeat(50) + ' ' + 'b'.repeat(50);
    const result = shortenSummary(raw, 60);
    assert.ok(result.endsWith('…'));
    assert.ok(!result.includes('b'));
});

test('shortenSummary: bỏ tag HTML và entity thường gặp trong RSS Google Tin tức', () => {
    const raw = '<a href="x">Đắk Lắk</a>&nbsp;&nbsp;Báo Tuổi Trẻ &amp; Dân Trí';
    assert.equal(shortenSummary(raw), 'Đắk Lắk Báo Tuổi Trẻ & Dân Trí');
});
