const { poolPromise } = require('../config/db');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');
const { sendPushToRoles, sendPushToUser } = require('../routes/pushRoutes');
const { logError } = require('../utils/errorLogger');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lấy danh sách tin — có phân trang + tìm kiếm + lọc ngày ở server, tránh
// kéo toàn bộ bảng Posts về mỗi lần tải trang (sẽ chậm dần khi dữ liệu lớn lên).
// Không truyền page/pageSize thì vẫn trả nguyên danh sách như cũ (tương thích
// ngược cho client cũ/script khác đang gọi endpoint này).
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllNews = async (req, res) => {
    try {
        const pool     = await poolPromise;
        const userRole = (req.user.Role || req.user.role || '').toLowerCase();
        const userID   = req.user.UserID;

        const { page, pageSize, search, filter, startDate, endDate } = req.query;
        const paginate = page !== undefined || pageSize !== undefined;
        const pageNum  = Math.max(1, parseInt(page, 10) || 1);
        const sizeNum  = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

        let request = pool.request();
        const where = [];

        if (['admin', 'người duyệt', 'trưởng ban', 'kiểm soát viên'].includes(userRole)) {
            // không lọc gì thêm — thấy toàn bộ (Kiểm soát viên chỉ xem, không có quyền
            // duyệt/khóa/sửa — các quyền đó được chặn riêng ở APPROVE_ROLES/LOCK_ROLES
            // và canEdit/canApproveOrReject phía frontend)
        } else if (userRole === 'thư ký') {
            where.push('p.StatusID = 2');
        } else {
            where.push('p.AuthorID = @UserID');
            request.input('UserID', userID);
        }

        if (filter === 'pending') {
            where.push('(p.StatusID = 1 OR p.StatusID = 0)');
        }
        if (search) {
            where.push('(p.Title LIKE @Search OR u.FullName LIKE @Search OR p.Content LIKE @Search)');
            request.input('Search', `%${search}%`);
        }
        if (startDate) {
            where.push('p.CreatedAt >= @StartDate');
            request.input('StartDate', startDate);
        }
        if (endDate) {
            where.push('p.CreatedAt <= @EndDate');
            request.input('EndDate', endDate);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        if (!paginate) {
            const result = await request.query(`
                SELECT p.*, u.FullName as AuthorName FROM dbo.Posts p
                LEFT JOIN dbo.Users u ON p.AuthorID = u.UserID
                ${whereSql}
                ORDER BY p.CreatedAt DESC
            `);
            return res.json(result.recordset || []);
        }

        request.input('Offset', (pageNum - 1) * sizeNum);
        request.input('PageSize', sizeNum);

        const result = await request.query(`
            SELECT p.*, u.FullName as AuthorName, COUNT(*) OVER() AS TotalCount
            FROM dbo.Posts p
            LEFT JOIN dbo.Users u ON p.AuthorID = u.UserID
            ${whereSql}
            ORDER BY p.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
        `);

        const rows  = result.recordset || [];
        const total = rows.length ? rows[0].TotalCount : 0;
        rows.forEach(r => delete r.TotalCount);

        res.json({ posts: rows, total, page: pageNum, pageSize: sizeNum, totalPages: Math.ceil(total / sizeNum) });
    } catch (err) {
        logError({ source: 'newsController.getAllNews', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Gửi bài mới + Push thông báo cho người duyệt
// ─────────────────────────────────────────────────────────────────────────────
exports.createNews = async (req, res) => {
    try {
        console.log('📥 [createNews] body:', JSON.stringify(req.body));

        const {
            tieuDe, sapo, noiDung,
            kieu, ten, hinhAnh,
            Category, StoragePath, StatusID
        } = req.body;

        // ✅ Lấy AuthorID từ token đã xác thực, không tin dữ liệu client gửi lên
        const AuthorID = req.user.UserID;

        const pool = await poolPromise;

        const packedContent = JSON.stringify({
            kieu:    kieu    || 'Tin',
            ten:     ten     || '',
            hinhAnh: hinhAnh || '',
            sapo:    sapo    || '',
            noiDung: noiDung || ''
        });

        const safeCategoryInt = parseInt(Category);
        const finalCategory   = isNaN(safeCategoryInt) ? 0 : safeCategoryInt;

        // INSERT bài viết
        const insertResult = await pool.request()
            .input('Title',       tieuDe || 'Bài viết mới')
            .input('Content',     packedContent)
            .input('AuthorID',    parseInt(AuthorID) || null)
            .input('StoragePath', StoragePath || null)
            .input('Category',    finalCategory)
            .input('StatusID',    parseInt(StatusID) || 1)
            .input('IsLocked',    0)
            .query(`
                INSERT INTO dbo.Posts 
                    (Title, Content, AuthorID, StoragePath, Category, StatusID, IsLocked, CreatedAt)
                OUTPUT INSERTED.PostID
                VALUES 
                    (@Title, @Content, @AuthorID, @StoragePath, @Category, @StatusID, @IsLocked, GETDATE())
            `);

        const newPostId = insertResult.recordset[0]?.PostID;

        // ✅ Push thông báo cho người duyệt (không await để không delay response)
        // "Thư ký" không nằm trong danh sách — họ không thấy được bài chờ duyệt
        // (xem getAllNews), báo cho họ chỉ dẫn tới link chết.
        sendPushToRoles(
            ['admin', 'người duyệt', 'trưởng ban'],
            '📰 Bài mới cần duyệt',
            `"${tieuDe || 'Bài viết mới'}" – gửi bởi ${ten || 'CTV'}`,
            `/news/${newPostId}`
        ).catch(err => console.warn('⚠️ [Push] Gửi thông báo thất bại:', err.message));

        res.json({ success: true, message: 'Đã gửi bài viết thành công!' });

    } catch (err) {
        console.error('❌ [createNews] Lỗi:', err.message);
        logError({ source: 'newsController.createNews', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Thống kê Dashboard
// ─────────────────────────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
    try {
        const pool     = await poolPromise;
        const userRole = (req.user.Role || req.user.role || '').toLowerCase();
        const userID   = req.user.UserID;
        let totalPosts, postsToday;

        if (['admin', 'người duyệt', 'trưởng ban', 'thư ký', 'kiểm soát viên'].includes(userRole)) {
            const result = await pool.request().query(`
                SELECT
                    (SELECT COUNT(*) FROM dbo.Posts) as TotalPosts,
                    (SELECT COUNT(*) FROM dbo.Posts WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)) as PostsToday
            `);
            totalPosts = result.recordset[0].TotalPosts;
            postsToday = result.recordset[0].PostsToday;
        } else {
            const result = await pool.request()
                .input('UserID', userID)
                .query(`
                    SELECT
                        (SELECT COUNT(*) FROM dbo.Posts WHERE AuthorID = @UserID) as TotalPosts,
                        (SELECT COUNT(*) FROM dbo.Posts WHERE AuthorID = @UserID AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)) as PostsToday
                `);
            totalPosts = result.recordset[0].TotalPosts;
            postsToday = result.recordset[0].PostsToday;
        }

        const usersResult = await pool.request().query('SELECT COUNT(*) as TotalUsers FROM dbo.Users');
        res.json({ TotalPosts: totalPosts, PostsToday: postsToday, TotalUsers: usersResult.recordset[0].TotalUsers });
    } catch (err) {
        logError({ source: 'newsController.getDashboardStats', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Xóa bài viết
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteNews = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('PostID', id)
            .query('DELETE FROM dbo.Posts WHERE PostID = @PostID');
        res.json({ success: true, message: 'Đã xóa bài!' });
    } catch (err) {
        logError({ source: 'newsController.deleteNews', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Phê duyệt / Từ chối
// ─────────────────────────────────────────────────────────────────────────────
exports.approveNews = async (req, res) => {
    const { id }     = req.params;
    const { status } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('PostID',   id)
            .input('StatusID', parseInt(status) || 1)
            .query('UPDATE dbo.Posts SET StatusID = @StatusID WHERE PostID = @PostID');
        const msg = parseInt(status) === 2 ? 'Đã phê duyệt!' : 'Đã từ chối!';
        res.json({ success: true, message: msg });
    } catch (err) {
        console.error('❌ [approveNews] Lỗi:', err.message);
        logError({ source: 'newsController.approveNews', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Khóa / Mở bài viết
// ─────────────────────────────────────────────────────────────────────────────
exports.lockNews = async (req, res) => {
    const { id }   = req.params;
    const { lock } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('PostID',   id)
            .input('IsLocked', lock ? 1 : 0)
            .query('UPDATE dbo.Posts SET IsLocked = @IsLocked WHERE PostID = @PostID');
        res.json({ success: true, message: lock ? 'Đã khóa bài!' : 'Đã mở bài!' });
    } catch (err) {
        logError({ source: 'newsController.lockNews', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Editor duyệt kèm file mới
// ─────────────────────────────────────────────────────────────────────────────
exports.editorApprove = async (req, res) => {
    const { id } = req.params;
    const { storagePath, categoryName } = req.body;
    // ✅ Lấy EditorID từ token đã xác thực, không tin editorId client gửi lên
    // (route này chỉ vào được qua requireRoles(APPROVE_ROLES) nên req.user luôn là người có quyền duyệt).
    const editorId = req.user.UserID;
    const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || path.join(__dirname, '../uploads'));

    try {
        const pool       = await poolPromise;
        const postResult = await pool.request()
            .input('PostID', id)
            .query('SELECT * FROM dbo.Posts WHERE PostID = @PostID');

        const post = postResult.recordset[0];
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        if (post.StoragePath) {
            try {
                const oldFullPath = path.resolve(STORAGE_ROOT, post.StoragePath.replace(/^Storage\//, ''));
                if (fs.existsSync(oldFullPath)) fs.unlinkSync(oldFullPath);
            } catch (e) { console.log('⚠️ Không xóa được file cũ:', e.message); }
        }

        await pool.request()
            .input('PostID',       id)
            .input('StoragePath',  storagePath)
            .input('EditorID',     editorId)
            .input('CategoryName', categoryName || null)
            .query(`UPDATE dbo.Posts SET StatusID=2, StoragePath=@StoragePath, EditorID=@EditorID, CategoryName=@CategoryName, IsLocked=0, LockedBy=NULL, ApprovedAt=GETDATE(), ApprovedBy=@EditorID WHERE PostID=@PostID`);

        // ✅ Push thông báo cho CTV
        if (post.AuthorID) {
            sendPushToUser(
                post.AuthorID,
                '✅ Bài viết đã được duyệt!',
                `"${post.Title}" đã được chỉnh sửa và phê duyệt. Tải về ngay!`,
                `/news/${id}`
            ).catch(err => console.warn('⚠️ [Push] Gửi thông báo thất bại:', err.message));
        }

        res.json({ success: true, message: 'Đã duyệt bài và cập nhật file!' });
    } catch (err) {
        console.error('❌ [editorApprove] Lỗi:', err);
        logError({ source: 'newsController.editorApprove', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Xuất file Word từ template
// ─────────────────────────────────────────────────────────────────────────────
exports.exportStoryboard = async (req, res) => {
    try {
        const { kieu, tieuDe, ten, hinhAnh, sapo, noiDung } = req.body;
        const templatePath = path.resolve(__dirname, '../../mau_tin_bai.docx');
        const backupPath   = path.resolve('mau_tin_bai.docx');
        const chosenPath   = fs.existsSync(templatePath) ? templatePath : fs.existsSync(backupPath) ? backupPath : null;

        if (!chosenPath) return res.status(404).json({ error: 'Không tìm thấy file mẫu mau_tin_bai.docx!' });

        const doc = new Docxtemplater(new PizZip(fs.readFileSync(chosenPath, 'binary')), { paragraphLoop: true, linebreaks: true });
        doc.render({ kiểu: kieu||'', TieuDe: tieuDe ? tieuDe.toUpperCase() : 'BẢN TIN PHÂN CẢNH', Ten: ten||'', HinhAnh: hinhAnh||'', Sapo: sapo||'', NoiDung: noiDung||'' });

        const buf       = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        const safeTitle = tieuDe ? tieuDe.replace(/[/\\?%*:|"<>\.]/g, '').trim() : 'Ban_Phan_Canh';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.docx`);
        res.send(buf);
    } catch (err) {
        console.error('❌ [exportStoryboard] Lỗi:', err);
        logError({ source: 'newsController.exportStoryboard', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Lỗi xuất file Word: ' + err.message });
    }
};

exports.exportNewsWord = async (req, res) => {
    try {
        const { id }   = req.params;
        const pool     = await poolPromise;
        const result   = await pool.request().input('PostID', id).query('SELECT * FROM dbo.Posts WHERE PostID = @PostID');
        if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

        const post = result.recordset[0];
        let scriptData = {};
        try { scriptData = JSON.parse(post.Content); } catch { scriptData = { noiDung: post.Content }; }

        const templatePath = path.resolve(__dirname, '../../mau_tin_bai.docx');
        const backupPath   = path.resolve('mau_tin_bai.docx');
        const chosenPath   = fs.existsSync(templatePath) ? templatePath : fs.existsSync(backupPath) ? backupPath : null;
        if (!chosenPath) return res.status(404).json({ error: 'Không tìm thấy file mẫu mau_tin_bai.docx!' });

        const doc = new Docxtemplater(new PizZip(fs.readFileSync(chosenPath, 'binary')), { paragraphLoop: true, linebreaks: true });
        doc.setData({ kiểu: scriptData.kieu||'Tin', TieuDe: post.Title ? post.Title.toUpperCase() : '', Ten: scriptData.ten||'', HinhAnh: scriptData.hinhAnh||'', Sapo: scriptData.sapo||'', NoiDung: scriptData.noiDung||'' });
        doc.render();

        const buf = doc.getZip().generate({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=Ban_phan_canh_${id}.docx`);
        return res.send(buf);
    } catch (err) {
        console.error('❌ [exportNewsWord] Lỗi:', err.message);
        logError({ source: 'newsController.exportNewsWord', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: 'Không thể xuất file Word: ' + err.message });
    }
};