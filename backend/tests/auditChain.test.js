const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256, verifyChain } = require('../utils/auditChain');

test('verifyChain: chuỗi hợp lệ (mỗi ChainHash khớp SHA256(PrevChainHash+ContentHash))', () => {
    const c1 = sha256('nội dung 1');
    const chain1 = sha256('' + c1);
    const c2 = sha256('nội dung 2');
    const chain2 = sha256(chain1 + c2);

    const rows = [
        { PrevChainHash: null, ContentHash: c1, ChainHash: chain1 },
        { PrevChainHash: chain1, ContentHash: c2, ChainHash: chain2 }
    ];

    assert.equal(verifyChain(rows), true);
});

test('verifyChain: phát hiện ContentHash bị sửa ngầm (ChainHash lưu sẵn không còn khớp)', () => {
    const c1 = sha256('nội dung 1');
    const chain1 = sha256('' + c1);

    const rows = [
        { PrevChainHash: null, ContentHash: sha256('nội dung bị sửa'), ChainHash: chain1 }
    ];

    assert.equal(verifyChain(rows), false);
});

test('verifyChain: phát hiện PrevChainHash bị sửa để trỏ sai mắt xích trước', () => {
    const c1 = sha256('nội dung 1');
    const chain1 = sha256('' + c1);
    const c2 = sha256('nội dung 2');
    const chain2 = sha256(chain1 + c2);

    const rows = [
        { PrevChainHash: null, ContentHash: c1, ChainHash: chain1 },
        { PrevChainHash: 'gia-mao', ContentHash: c2, ChainHash: chain2 }
    ];

    assert.equal(verifyChain(rows), false);
});

test('verifyChain: chuỗi rỗng luôn hợp lệ', () => {
    assert.equal(verifyChain([]), true);
});
