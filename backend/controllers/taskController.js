const { poolPromise } = require('../config/db');
const { logError } = require('../utils/errorLogger');
const { isValidStatus, timestampsForStatus, TASK_STATUSES } = require('../utils/taskStatus');
const { getIO } = require('../sockets/ioHolder');
const { sendPushToUser } = require('../routes/pushRoutes');

// Tên người và tên bài luôn JOIN lúc đọc, không lưu bản sao trong dbo.Tasks — đổi tên
// tài khoản hay sửa tiêu đề bài thì việc cũ phải hiện tên mới, không phải tên đóng băng.
const TASK_SELECT = `
    SELECT
        t.TaskID, t.Title, t.Description, t.AssignerID, t.AssigneeID, t.PostID,
        t.Status, t.AssignedAt, t.DueAt, t.StartedAt, t.CompletedAt, t.UpdatedAt,
        assigner.FullName AS AssignerName,
        assignee.FullName AS AssigneeName,
        p.Title AS PostTitle
    FROM dbo.Tasks t
    LEFT JOIN dbo.Users assigner ON assigner.UserID = t.AssignerID
    LEFT JOIN dbo.Users assignee ON assignee.UserID = t.AssigneeID
    LEFT JOIN dbo.Posts p ON p.PostID = t.PostID
`;

// Lịch tháng lọc theo hạn hoàn thành, nhưng việc CHƯA đặt hạn thì cũng phải thấy được,
// nếu không nó biến mất khỏi mọi khoảng ngày và người nhận không bao giờ biết mình có.
const DATE_FILTER = `
    AND (
        (t.DueAt IS NOT NULL AND t.DueAt >= @From AND t.DueAt < @To)
        OR (t.DueAt IS NULL AND t.AssignedAt >= @From AND t.AssignedAt < @To)
    )
`;

const MAX_RANGE_DAYS = 200;   // trần khoảng ngày, chặn client hỏi cả chục năm một lượt
const UPCOMING_LIMIT = 8;     // số việc hiện trong ô tóm tắt ngoài Dashboard

// Thiếu from/to thì mặc định lấy tháng hiện tại — giao diện lịch luôn mở ở tháng này.
function parseRange(query) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ? new Date(query.to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return { error: 'Khoảng ngày không hợp lệ.' };
    }
    if (to <= from) return { error: 'Ngày kết thúc phải sau ngày bắt đầu.' };
    if ((to - from) / 86400000 > MAX_RANGE_DAYS) {
        return { error: `Chỉ xem được tối đa ${MAX_RANGE_DAYS} ngày mỗi lần.` };
    }
    return { from, to };
}

async function queryTasks({ column, userId, from, to }) {
    const pool = await poolPromise;
    return pool.request()
        .input('UserID', userId)
        .input('From', from)
        .input('To', to)
        .query(`${TASK_SELECT} WHERE t.${column} = @UserID ${DATE_FILTER} ORDER BY COALESCE(t.DueAt, t.AssignedAt) ASC`);
}

// Báo cho người nhận/người giao biết có thay đổi. Socket để ai đang mở app thấy ngay,
// push để người đã đóng trình duyệt vẫn nhận được — cùng hạ tầng chat đang dùng.
function notifyUser(userId, { event, task, pushTitle, pushBody }) {
    try {
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit(event, task);
    } catch (err) {
        // Socket chết không được phép làm hỏng lượt giao việc đã ghi xong vào DB.
        logError({ source: 'taskController.notifyUser.socket', message: err.message, stack: err.stack, userId });
    }
    sendPushToUser(userId, pushTitle, pushBody, '/tasks');
}

// GET /api/tasks/mine — việc người đang đăng nhập phải làm.
exports.getMyTasks = async (req, res) => {
    try {
        const range = parseRange(req.query);
        if (range.error) return res.status(400).json({ error: range.error });

        const result = await queryTasks({ column: 'AssigneeID', userId: req.user.UserID, ...range });
        res.json({ tasks: result.recordset || [] });
    } catch (err) {
        logError({ source: 'taskController.getMyTasks', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// GET /api/tasks/assigned — việc chính người này đã giao cho người khác.
exports.getAssignedTasks = async (req, res) => {
    try {
        const range = parseRange(req.query);
        if (range.error) return res.status(400).json({ error: range.error });

        const result = await queryTasks({ column: 'AssignerID', userId: req.user.UserID, ...range });
        res.json({ tasks: result.recordset || [] });
    } catch (err) {
        logError({ source: 'taskController.getAssignedTasks', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// GET /api/tasks/upcoming — vài việc gần hạn nhất, cho ô tóm tắt ngoài Dashboard.
exports.getUpcoming = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .query(`
                ${TASK_SELECT}
                WHERE t.AssigneeID = @UserID AND t.Status <> 'done'
                ORDER BY CASE WHEN t.DueAt IS NULL THEN 1 ELSE 0 END, t.DueAt ASC, t.AssignedAt ASC
                OFFSET 0 ROWS FETCH NEXT ${UPCOMING_LIMIT} ROWS ONLY
            `);
        res.json({ tasks: result.recordset || [] });
    } catch (err) {
        logError({ source: 'taskController.getUpcoming', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// Bảng Tasks cố ý không có FOREIGN KEY (xem scripts/create-tasks-table.js) nên PostID
// sai hoặc trỏ tới bài đã xoá sẽ nằm lại im lặng trong bản ghi, và giao diện hiện link
// "Bài #123" bấm vào không ra gì. Tự kiểm ở đây thay cho ràng buộc DB.
async function postExists(pool, postId) {
    if (!postId) return true;
    const result = await pool.request()
        .input('PostID', postId)
        .query('SELECT TOP 1 PostID FROM dbo.Posts WHERE PostID = @PostID');
    return (result.recordset?.length || 0) > 0;
}

async function findTaskById(taskId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('TaskID', taskId)
        .query(`${TASK_SELECT} WHERE t.TaskID = @TaskID`);
    return result.recordset?.[0] || null;
}

// POST /api/tasks — giao việc. Route đã chặn role, ở đây chỉ lo dữ liệu.
exports.createTask = async (req, res) => {
    try {
        const { Title, Description, AssigneeID, DueAt, PostID } = req.body;
        const pool = await poolPromise;

        // Không cho giao việc cho tài khoản không tồn tại (hoặc đã bị xoá) — bảng Tasks
        // cố ý không có FK nên phải tự kiểm ở đây, nếu không việc sẽ treo lơ lửng.
        const assignee = await pool.request()
            .input('UserID', AssigneeID)
            .query('SELECT UserID, FullName FROM dbo.Users WHERE UserID = @UserID');
        if (!assignee.recordset?.length) {
            return res.status(400).json({ error: 'Người nhận việc không tồn tại.' });
        }

        if (!await postExists(pool, PostID)) {
            return res.status(400).json({ error: 'Bài viết liên quan không tồn tại.' });
        }

        const insert = await pool.request()
            .input('Title', Title.trim())
            .input('Description', Description?.trim() || null)
            .input('AssignerID', req.user.UserID)
            .input('AssigneeID', AssigneeID)
            .input('PostID', PostID || null)
            .input('DueAt', DueAt ? new Date(DueAt) : null)
            .query(`
                INSERT INTO dbo.Tasks (Title, Description, AssignerID, AssigneeID, PostID, DueAt)
                OUTPUT INSERTED.TaskID
                VALUES (@Title, @Description, @AssignerID, @AssigneeID, @PostID, @DueAt)
            `);

        const task = await findTaskById(insert.recordset[0].TaskID);
        notifyUser(AssigneeID, {
            event: 'task:new',
            task,
            pushTitle: 'Bạn được giao việc mới',
            // Lấy tên từ bản ghi vừa JOIN chứ không từ req.user — JWT chỉ mang UserID và
            // Role (xem authController.login), không có FullName.
            pushBody: `${task.AssignerName || 'Người duyệt'}: ${task.Title}`
        });

        res.status(201).json({ task });
    } catch (err) {
        logError({ source: 'taskController.createTask', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// PATCH /api/tasks/:id/status — người nhận báo tiến độ (người giao cũng sửa được).
exports.updateStatus = async (req, res) => {
    try {
        const { Status } = req.body;
        if (!isValidStatus(Status)) {
            return res.status(400).json({ error: `Trạng thái phải là một trong: ${TASK_STATUSES.join(', ')}.` });
        }

        const task = await findTaskById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc.' });

        // Người ngoài cuộc không được đụng vào tiến độ việc của người khác.
        const userId = req.user.UserID;
        if (task.AssigneeID !== userId && task.AssignerID !== userId && req.user.Role?.toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Bạn không có quyền cập nhật công việc này.' });
        }

        const stamps = timestampsForStatus(Status, task);
        const pool = await poolPromise;
        await pool.request()
            .input('TaskID', task.TaskID)
            .input('Status', Status)
            .input('StartedAt', stamps.StartedAt)
            .input('CompletedAt', stamps.CompletedAt)
            .query(`
                UPDATE dbo.Tasks
                SET Status = @Status, StartedAt = @StartedAt, CompletedAt = @CompletedAt, UpdatedAt = GETUTCDATE()
                WHERE TaskID = @TaskID
            `);

        const updated = await findTaskById(task.TaskID);

        // Người giao cần biết tiến độ; nhưng tự mình đổi thì khỏi tự báo cho mình.
        if (task.AssignerID !== userId) {
            notifyUser(task.AssignerID, {
                event: 'task:updated',
                task: updated,
                pushTitle: 'Công việc có cập nhật',
                pushBody: `${updated.AssigneeName || 'Người nhận'} đã đổi trạng thái: ${updated.Title}`
            });
        }

        res.json({ task: updated });
    } catch (err) {
        logError({ source: 'taskController.updateStatus', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// Chỉ người đã giao việc (hoặc admin) mới được sửa/xoá — người nhận chỉ báo tiến độ.
function canManage(task, user) {
    return task.AssignerID === user.UserID || user.Role?.toLowerCase() === 'admin';
}

// PUT /api/tasks/:id — sửa nội dung việc đã giao.
exports.updateTask = async (req, res) => {
    try {
        const task = await findTaskById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc.' });
        if (!canManage(task, req.user)) {
            return res.status(403).json({ error: 'Chỉ người giao việc mới sửa được công việc này.' });
        }

        const { Title, Description, DueAt, PostID } = req.body;
        const pool = await poolPromise;

        if (!await postExists(pool, PostID)) {
            return res.status(400).json({ error: 'Bài viết liên quan không tồn tại.' });
        }

        await pool.request()
            .input('TaskID', task.TaskID)
            .input('Title', Title.trim())
            .input('Description', Description?.trim() || null)
            .input('DueAt', DueAt ? new Date(DueAt) : null)
            .input('PostID', PostID || null)
            .query(`
                UPDATE dbo.Tasks
                SET Title = @Title, Description = @Description, DueAt = @DueAt,
                    PostID = @PostID, UpdatedAt = GETUTCDATE()
                WHERE TaskID = @TaskID
            `);

        const updated = await findTaskById(task.TaskID);
        notifyUser(task.AssigneeID, {
            event: 'task:updated',
            task: updated,
            pushTitle: 'Công việc được sửa',
            pushBody: updated.Title
        });

        res.json({ task: updated });
    } catch (err) {
        logError({ source: 'taskController.updateTask', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};

// DELETE /api/tasks/:id — thu hồi việc đã giao.
exports.deleteTask = async (req, res) => {
    try {
        const task = await findTaskById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc.' });
        if (!canManage(task, req.user)) {
            return res.status(403).json({ error: 'Chỉ người giao việc mới xóa được công việc này.' });
        }

        const pool = await poolPromise;
        await pool.request().input('TaskID', task.TaskID).query('DELETE FROM dbo.Tasks WHERE TaskID = @TaskID');

        notifyUser(task.AssigneeID, {
            event: 'task:deleted',
            task: { TaskID: task.TaskID },
            pushTitle: 'Công việc đã bị thu hồi',
            pushBody: task.Title
        });

        res.json({ success: true });
    } catch (err) {
        logError({ source: 'taskController.deleteTask', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
    }
};
