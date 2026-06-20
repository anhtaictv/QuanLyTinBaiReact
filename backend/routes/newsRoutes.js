const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// ✅ Sửa lại đường dẫn và import cả 2 hàm
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Áp dụng verifyToken cho tất cả các route bên dưới để bảo mật
router.use(verifyToken); 

router.get('/', newsController.getAllNews);
router.post('/', newsController.createNews);
router.get('/stats', newsController.getDashboardStats);
router.put('/:id/status', newsController.approveNews);

// ✅ Chỉ Admin mới được xóa
router.delete('/:id', isAdmin, newsController.deleteNews);

// ✅ Route khóa bài và Editor duyệt
router.post('/:id/lock', newsController.lockNews);
router.post('/:id/editor-approve', newsController.editorApprove);

router.post('/news/:id/export-storyboard', verifyToken, newsController.exportStoryboard);

module.exports = router;