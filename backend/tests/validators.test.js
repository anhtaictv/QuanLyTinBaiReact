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
