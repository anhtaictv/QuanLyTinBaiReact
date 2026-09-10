const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const { registerRules, loginRules, changePasswordRules, createNewsRules } = require('../middleware/validators');

async function runRules(rules, body) {
    const req = { body };
    for (const rule of rules) {
        await rule.run(req);
    }
    return validationResult(req);
}

test('registerRules: từ chối username quá ngắn', async () => {
    const result = await runRules(registerRules, { Username: 'ab', Password: '123456', FullName: 'Nguyễn Văn A' });
    assert.equal(result.isEmpty(), false);
});

test('registerRules: từ chối password dưới 6 ký tự', async () => {
    const result = await runRules(registerRules, { Username: 'abcdef', Password: '123', FullName: 'Nguyễn Văn A' });
    assert.equal(result.isEmpty(), false);
});

test('registerRules: cho qua dữ liệu hợp lệ, Age/Department bỏ trống vẫn OK', async () => {
    const result = await runRules(registerRules, { Username: 'abcdef', Password: '123456', FullName: 'Nguyễn Văn A' });
    assert.equal(result.isEmpty(), true);
});

test('registerRules: từ chối Age ngoài khoảng hợp lệ', async () => {
    const result = await runRules(registerRules, { Username: 'abcdef', Password: '123456', FullName: 'Nguyễn Văn A', Age: 5 });
    assert.equal(result.isEmpty(), false);
});

test('loginRules: từ chối thiếu Password', async () => {
    const result = await runRules(loginRules, { Username: 'abcdef' });
    assert.equal(result.isEmpty(), false);
});

test('changePasswordRules: từ chối NewPassword quá ngắn', async () => {
    const result = await runRules(changePasswordRules, { OldPassword: 'oldpass', NewPassword: '123' });
    assert.equal(result.isEmpty(), false);
});

test('createNewsRules: từ chối tiêu đề rỗng', async () => {
    const result = await runRules(createNewsRules, { tieuDe: '   ' });
    assert.equal(result.isEmpty(), false);
});

test('createNewsRules: cho qua tiêu đề hợp lệ', async () => {
    const result = await runRules(createNewsRules, { tieuDe: 'Bài viết thử nghiệm' });
    assert.equal(result.isEmpty(), true);
});

// ─── Module Lịch công việc ────────────────────────────────────────────────────
const { createTaskRules, updateStatusRules, taskIdRule } = require('../middleware/validators');

// runRules ở trên chỉ dựng req.body; luật taskIdRule đọc req.params nên cần thêm bản này.
async function runRulesWithParams(rules, { body = {}, params = {} }) {
    const req = { body, params };
    for (const rule of rules) {
        await rule.run(req);
    }
    return validationResult(req);
}

test('createTaskRules: cho qua khi đủ tên việc và người nhận', async () => {
    const result = await runRules(createTaskRules, { Title: 'Viết bài hội nghị', AssigneeID: 7 });
    assert.equal(result.isEmpty(), true);
});

test('createTaskRules: từ chối khi thiếu tên công việc', async () => {
    const result = await runRules(createTaskRules, { Title: '   ', AssigneeID: 7 });
    assert.equal(result.isEmpty(), false);
});

test('createTaskRules: từ chối khi chưa chọn người nhận', async () => {
    const result = await runRules(createTaskRules, { Title: 'Viết bài hội nghị' });
    assert.equal(result.isEmpty(), false);
});

test('createTaskRules: hạn hoàn thành và bài liên quan bỏ trống vẫn hợp lệ', async () => {
    // Giao việc hành chính thì không có hạn cứng và không gắn bài nào — đây là đường đi
    // thường gặp nhất, không được bắt lỗi oan.
    const result = await runRules(createTaskRules, { Title: 'Trực cơ quan thứ 7', AssigneeID: 3, DueAt: '', PostID: '' });
    assert.equal(result.isEmpty(), true);
});

test('createTaskRules: từ chối hạn hoàn thành không phải ngày giờ hợp lệ', async () => {
    const result = await runRules(createTaskRules, { Title: 'Viết bài', AssigneeID: 3, DueAt: 'ngày mai' });
    assert.equal(result.isEmpty(), false);
});

test('updateStatusRules: từ chối khi thiếu trạng thái', async () => {
    const result = await runRules(updateStatusRules, {});
    assert.equal(result.isEmpty(), false);
});

test('taskIdRule: chặn mã công việc không phải số ngay tại tầng route', async () => {
    // Không có luật này thì 'abc' đi thẳng xuống SQL Server, lỗi ép kiểu biến thành 500
    // vô nghĩa trong ErrorLogs thay vì 400 có câu chữ rõ ràng.
    const result = await runRulesWithParams(taskIdRule, { params: { id: 'abc' } });
    assert.equal(result.isEmpty(), false);
});

test('taskIdRule: cho qua mã công việc hợp lệ', async () => {
    const result = await runRulesWithParams(taskIdRule, { params: { id: '42' } });
    assert.equal(result.isEmpty(), true);
});
