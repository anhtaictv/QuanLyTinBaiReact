const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// ✅ Sửa lại đường dẫn và import cả 2 hàm
const { verifyToken, isAdmin, requireRoles } = require('../middleware/authMiddleware');
const { handleValidation, createNewsRules } = require('../middleware/validators');

// Áp dụng verifyToken cho tất cả các route bên dưới để bảo mật
router.use(verifyToken);

// Các role được phép duyệt/từ chối/khóa bài (khớp với phân quyền hiển thị ở frontend).
// "Thư ký" KHÔNG có trong đây — họ chỉ xử lý bài đã duyệt (StatusID=2, xem getAllNews),
// không thấy/không duyệt được bài đang chờ duyệt.
const APPROVE_ROLES = ['admin', 'người duyệt', 'trưởng ban'];
const LOCK_ROLES     = ['admin', 'trưởng ban'];

router.get('/', newsController.getAllNews);
router.post('/', createNewsRules, handleValidation, newsController.createNews);
router.get('/stats', newsController.getDashboardStats);
router.put('/:id/status', requireRoles(...APPROVE_ROLES), newsController.approveNews);

// ✅ Chỉ Admin mới được xóa
router.delete('/:id', isAdmin, newsController.deleteNews);

// ✅ Route khóa bài và Editor duyệt
router.post('/:id/lock', requireRoles(...LOCK_ROLES), newsController.lockNews);
router.post('/:id/editor-approve', requireRoles(...APPROVE_ROLES), newsController.editorApprove);

router.post('/news/:id/export-storyboard', verifyToken, newsController.exportStoryboard);

module.exports = router;