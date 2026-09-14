const { body, param, validationResult } = require('express-validator');

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
    body('Email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Email không hợp lệ!').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
];

const loginRules = [
    body('Username').trim().notEmpty().withMessage('Thiếu Username hoặc Password!'),
    body('Password').notEmpty().withMessage('Thiếu Username hoặc Password!'),
];

const changePasswordRules = [
    body('OldPassword').notEmpty().withMessage('Thiếu thông tin!'),
    body('NewPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải từ 6 ký tự trở lên!'),
];

const updateEmailRules = [
    body('Email').trim().isEmail().withMessage('Email không hợp lệ!').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
];

const forgotPasswordRules = [
    body('Username').trim().notEmpty().withMessage('Vui lòng nhập tên đăng nhập!'),
    body('Email').trim().isEmail().withMessage('Email không hợp lệ!').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
];

const resetPasswordRules = [
    body('token').trim().notEmpty().withMessage('Thiếu token đặt lại mật khẩu!'),
    body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải từ 6 ký tự trở lên!'),
];

const createNewsRules = [
    body('tieuDe').trim().isLength({ min: 1, max: 500 }).withMessage('Vui lòng nhập tiêu đề bài viết!'),
];

// Module Lịch công việc. Trạng thái KHÔNG validate ở đây mà trong controller, để danh
// sách mã hợp lệ chỉ tồn tại một chỗ duy nhất là utils/taskStatus.js.
const taskFieldRules = [
    body('Title').trim().isLength({ min: 1, max: 300 }).withMessage('Vui lòng nhập tên công việc (tối đa 300 ký tự)!'),
    body('Description').optional({ values: 'falsy' }).trim().isLength({ max: 4000 }).withMessage('Mô tả công việc quá dài!'),
    body('DueAt').optional({ values: 'falsy' }).isISO8601().withMessage('Hạn hoàn thành không hợp lệ!'),
    body('PostID').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Bài viết liên quan không hợp lệ!'),
];

const createTaskRules = [
    ...taskFieldRules,
    body('AssigneeID').isInt({ min: 1 }).withMessage('Vui lòng chọn người nhận việc!'),
];

const updateTaskRules = [...taskFieldRules];

const updateStatusRules = [
    body('Status').trim().notEmpty().withMessage('Thiếu trạng thái công việc!'),
];

// :id không phải số thì chặn ngay bằng 400 có câu chữ rõ ràng, thay vì để SQL Server tự
// ép kiểu rồi ném lỗi và biến thành 500 vô nghĩa trong ErrorLogs.
const taskIdRule = [
    param('id').isInt({ min: 1 }).withMessage('Mã công việc không hợp lệ!'),
];

module.exports = {
    handleValidation, registerRules, loginRules, changePasswordRules, createNewsRules,
    updateEmailRules, forgotPasswordRules, resetPasswordRules,
    createTaskRules, updateTaskRules, updateStatusRules, taskIdRule,
};
