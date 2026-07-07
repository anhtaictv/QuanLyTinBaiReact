const { body, validationResult } = require('express-validator');

// Middleware dùng chung sau các validation chain — trả lỗi 400 gọn, đúng format
// { success:false, message } đã dùng thống nhất trong toàn bộ authController.
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0].msg
        });
    }
    next();
}

const registerRules = [
    body('Username').trim().isLength({ min: 3, max: 50 }).withMessage('Tên đăng nhập phải từ 3-50 ký tự!'),
    body('Password').isLength({ min: 6 }).withMessage('Mật khẩu phải từ 6 ký tự trở lên!'),
    body('FullName').trim().isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2-100 ký tự!'),
    body('Age').optional({ values: 'falsy' }).isInt({ min: 16, max: 100 }).withMessage('Tuổi không hợp lệ!'),
    body('Department').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Tên đơn vị quá dài!'),
];

const loginRules = [
    body('Username').trim().notEmpty().withMessage('Thiếu Username hoặc Password!'),
    body('Password').notEmpty().withMessage('Thiếu Username hoặc Password!'),
];

const changePasswordRules = [
    body('OldPassword').notEmpty().withMessage('Thiếu thông tin!'),
    body('NewPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải từ 6 ký tự trở lên!'),
];

const createNewsRules = [
    body('tieuDe').trim().isLength({ min: 1, max: 500 }).withMessage('Vui lòng nhập tiêu đề bài viết!'),
];

module.exports = { handleValidation, registerRules, loginRules, changePasswordRules, createNewsRules };
