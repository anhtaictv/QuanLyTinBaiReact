const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { requireRoles } = require('../middleware/authMiddleware');
const { createTaskRules, updateTaskRules, updateStatusRules, taskIdRule, handleValidation } = require('../middleware/validators');

// Cùng nhóm với quyền duyệt bài (routes/newsRoutes.js): ai duyệt được bài thì giao được
// việc. Giữ chung một danh sách để khỏi phải nhớ hai luật phân quyền khác nhau.
const ASSIGN_ROLES = ['admin', 'người duyệt', 'trưởng ban'];

// Đọc: ai cũng xem được việc CỦA MÌNH (controller đã lọc theo UserID trong token).
router.get('/mine', taskController.getMyTasks);
router.get('/upcoming', taskController.getUpcoming);

// Việc mình đã giao — chỉ người có quyền giao mới có danh sách này.
router.get('/assigned', requireRoles(...ASSIGN_ROLES), taskController.getAssignedTasks);

// Khối lượng việc hiện tại của từng người — để chọn người nhận không dồn việc vào 1 chỗ.
router.get('/workload', requireRoles(...ASSIGN_ROLES), taskController.getWorkload);

router.post('/', requireRoles(...ASSIGN_ROLES), createTaskRules, handleValidation, taskController.createTask);
router.put('/:id', requireRoles(...ASSIGN_ROLES), [...taskIdRule, ...updateTaskRules], handleValidation, taskController.updateTask);
router.delete('/:id', requireRoles(...ASSIGN_ROLES), taskIdRule, handleValidation, taskController.deleteTask);

// Báo tiến độ: KHÔNG chặn theo role — người nhận việc thường là CTV, họ phải tự đổi
// được trạng thái. Quyền trên từng việc do controller kiểm (chỉ người trong cuộc).
router.patch('/:id/status', [...taskIdRule, ...updateStatusRules], handleValidation, taskController.updateStatus);

module.exports = router;
