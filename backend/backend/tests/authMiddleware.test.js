process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-chi-dung-de-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { verifyToken, isAdmin, requireRoles } = require('../middleware/authMiddleware');

function mockRes() {
    const res = {};
    res.statusCode = null;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
}

function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET);
}

test('verifyToken: từ chối khi không có header Authorization', () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Không tìm thấy Token!');
});

test('verifyToken: từ chối token không hợp lệ', () => {
    const req = { headers: { authorization: 'Bearer token-gia-mao' } };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Token đã hết hạn hoặc không hợp lệ!');
});

test('verifyToken: cho qua và gắn req.user khi token hợp lệ', () => {
    const token = signToken({ UserID: 7, Role: 'CTV' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user.UserID, 7);
    assert.equal(req.user.Role, 'CTV');
});

test('isAdmin: chặn user không phải Admin', () => {
    const req = { user: { Role: 'CTV' } };
    const res = mockRes();
    let nextCalled = false;
    isAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

test('isAdmin: cho qua Admin, không phân biệt hoa/thường', () => {
    const req = { user: { Role: 'ADMIN' } };
    const res = mockRes();
    let nextCalled = false;
    isAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});

test('requireRoles: chỉ cho qua role nằm trong danh sách cho phép', () => {
    const middleware = requireRoles('Trưởng ban', 'Thư ký');

    const reqAllowed = { user: { Role: 'thư ký' } };
    const resAllowed = mockRes();
    let allowedNext = false;
    middleware(reqAllowed, resAllowed, () => { allowedNext = true; });
    assert.equal(allowedNext, true);

    const reqDenied = { user: { Role: 'CTV' } };
    const resDenied = mockRes();
    let deniedNext = false;
    middleware(reqDenied, resDenied, () => { deniedNext = true; });
    assert.equal(deniedNext, false);
    assert.equal(resDenied.statusCode, 403);
});
