const test = require('node:test');
const assert = require('node:assert/strict');
const { withVietnamese, VIETNAMESE_RULE, chat } = require('../services/aiGatewayClient');

// Giả lập gateway: mỗi phần tử replies là nội dung trả về cho một lượt gọi liên tiếp.
function stubGateway(replies) {
    const calls = [];
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
        calls.push(JSON.parse(options.body));
        const content = replies[calls.length - 1];
        return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { role: 'assistant', content } }] })
        };
    };

    return { calls, restore: () => { global.fetch = originalFetch; } };
}

test('withVietnamese: thêm system prompt khi hội thoại chưa có', () => {
    const input = [{ role: 'user', content: 'Thủ đô Việt Nam là gì?' }];
    const out = withVietnamese(input);

    assert.equal(out.length, 2);
    assert.equal(out[0].role, 'system');
    assert.equal(out[0].content, VIETNAMESE_RULE);
    assert.deepEqual(out[1], input[0]);
});

test('withVietnamese: nối luật vào system prompt sẵn có, giữ nguyên yêu cầu gốc', () => {
    const original = 'Chỉ trả về DUY NHẤT một mảng JSON các chuỗi.';
    const out = withVietnamese([
        { role: 'system', content: original },
        { role: 'user', content: 'Gợi ý tiêu đề' }
    ]);

    assert.equal(out.length, 2);
    assert.ok(out[0].content.startsWith(original), 'phải giữ nguyên yêu cầu định dạng gốc');
    assert.ok(out[0].content.includes(VIETNAMESE_RULE), 'phải kèm luật tiếng Việt');
});

test('withVietnamese: không sửa mảng gốc (immutable)', () => {
    const input = [
        { role: 'system', content: 'Bạn là biên tập viên.' },
        { role: 'user', content: 'Sửa câu này' }
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    withVietnamese(input);

    assert.deepEqual(input, snapshot);
});

test('withVietnamese: không nhân đôi luật khi gọi lại nhiều lần', () => {
    const once = withVietnamese([{ role: 'user', content: 'Xin chào' }]);
    const twice = withVietnamese(once);

    assert.deepEqual(twice, once);
    const occurrences = twice[0].content.split(VIETNAMESE_RULE).length - 1;
    assert.equal(occurrences, 1);
});

test('withVietnamese: chịu được đầu vào rỗng/không hợp lệ', () => {
    assert.deepEqual(withVietnamese([]), [{ role: 'system', content: VIETNAMESE_RULE }]);
    assert.deepEqual(withVietnamese(null), [{ role: 'system', content: VIETNAMESE_RULE }]);
});

test('chat: câu trả lời sạch tiếng Việt thì chỉ gọi gateway đúng 1 lần', async () => {
    const stub = stubGateway(['Hà Nội là thủ đô của Việt Nam.']);
    try {
        const reply = await chat([{ role: 'user', content: 'Thủ đô Việt Nam?' }]);
        assert.equal(reply, 'Hà Nội là thủ đô của Việt Nam.');
        assert.equal(stub.calls.length, 1);
    } finally {
        stub.restore();
    }
});

test('chat: trả lời lẫn tiếng Trung thì hỏi lại từ đầu và dùng bản tiếng Việt', async () => {
    const stub = stubGateway([
        '乔治·奥威尔写了小说《1984》。',
        'George Orwell là tác giả tiểu thuyết 1984.'
    ]);
    try {
        const reply = await chat([{ role: 'user', content: 'Who wrote the novel 1984?' }]);

        assert.equal(reply, 'George Orwell là tác giả tiểu thuyết 1984.');
        assert.equal(stub.calls.length, 2);

        const retry = stub.calls[1];
        // Đoạn chữ Trung hỏng KHÔNG được lọt vào ngữ cảnh lượt gọi lại, nếu không nó sẽ
        // kéo model tiếp tục viết tiếng Trung.
        const retryText = JSON.stringify(retry.messages);
        assert.equal(retryText.includes('乔治'), false, 'không được mang câu trả lời hỏng theo');

        // Lượt gọi lại phải kẹp luật gắt vào system prompt và hạ temperature.
        assert.match(retry.messages[0].content, /CỰC KỲ QUAN TRỌNG/);
        assert.equal(retry.temperature, 0.2);

        // Vẫn phải giữ nguyên câu hỏi gốc của người dùng.
        assert.equal(retry.messages[retry.messages.length - 1].content, 'Who wrote the novel 1984?');
    } finally {
        stub.restore();
    }
});

test('chat: viết lại vẫn lẫn tiếng Trung thì giữ bản gốc, không gọi thêm lần ba', async () => {
    const stub = stubGateway(['第一次回答', '第二次回答']);
    try {
        const reply = await chat([{ role: 'user', content: 'Hello' }]);
        assert.equal(reply, '第一次回答');
        assert.equal(stub.calls.length, 2);
    } finally {
        stub.restore();
    }
});
