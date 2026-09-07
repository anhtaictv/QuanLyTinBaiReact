const test = require('node:test');
const assert = require('node:assert/strict');
const PizZip = require('pizzip');
const { extractDocxText } = require('../utils/docxText');

function fakeDocx(bodyXml) {
    const zip = new PizZip();
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body>${bodyXml}</w:body></w:document>`);
    return zip.generate({ type: 'nodebuffer' });
}

test('extractDocxText: bóc text thuần từ document.xml, mỗi <w:p> thành 1 dòng', () => {
    const buf = fakeDocx('<w:p><w:r><w:t>Dòng một</w:t></w:r></w:p><w:p><w:r><w:t>Dòng hai</w:t></w:r></w:p>');
    const text = extractDocxText(buf);
    assert.match(text, /Dòng một/);
    assert.match(text, /Dòng hai/);
});

test('extractDocxText: file không phải docx hợp lệ trả về chuỗi rỗng, không throw', () => {
    assert.equal(extractDocxText(Buffer.from('không phải zip')), '');
});
