const express  = require('express');
const router   = express.Router();
const { google } = require('googleapis');
const fs       = require('fs');
const path     = require('path');
const { poolPromise } = require('../config/db');
const { sendPushToUser } = require('./pushRoutes');
const { logError } = require('../utils/errorLogger');
const { requireRoles } = require('../middleware/authMiddleware');
const { afterApprove } = require('../utils/postApproval');

// Chỉ role được duyệt bài mới được đưa bài qua Google Docs / hoàn tất chỉnh sửa —
// route này ghi đè file trên VPS và set StatusID=2 (duyệt), trước đây chỉ có
// verifyToken nên bất kỳ user nào đăng nhập (kể cả CTV) gọi thẳng /complete với
// postId của người khác là tự duyệt được bài, bỏ qua hẳn bước phê duyệt thật.
const APPROVE_ROLES = ['admin', 'người duyệt', 'trưởng ban'];

// ── CẤU HÌNH ──────────────────────────────────────────────────────────────────

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../uploads');
const FOLDER_ID    = process.env.GOOGLE_DRIVE_FOLDER_ID;
const TOKEN_PATH   = path.resolve('./google-token.json');

// ── OAUTH2 – tự động refresh token ────────────────────────────────────────────

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

// Load token từ file nếu có, không thì dùng từ .env
function loadToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const saved = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(saved);
      console.log('✅ [Drive] Đã load token từ google-token.json');
    } else {
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      console.log('✅ [Drive] Đã load token từ .env');
    }
  } catch {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }
}

// Tự động lưu token mới khi được Google refresh
oauth2Client.on('tokens', (tokens) => {
  const current = oauth2Client.credentials;
  const updated = { ...current, ...tokens };
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
    console.log('✅ [Drive] Token đã được tự động refresh và lưu vào google-token.json');
  } catch (e) {
    console.warn('⚠️ [Drive] Không thể lưu token:', e.message);
    logError({ source: 'driveRoutes.tokenSave', message: 'Không thể lưu token Drive mới sau khi refresh: ' + e.message, stack: e.stack });
  }
});

loadToken();
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// ── HEALTH CHECK – phát hiện sớm khi refresh token bị thu hồi/hết hạn ─────────
// oauth2Client tự refresh access token âm thầm; nếu refresh token bên dưới bị
// thu hồi hoặc hết hạn (Google Cloud OAuth ở chế độ Testing tự hết hạn sau 7
// ngày), lỗi chỉ lộ ra khi có người dùng thật bấm "đưa qua Google Docs" — lúc
// đó CTV/biên tập đang giữa quy trình duyệt bài mới biết. Kiểm tra định kỳ để
// Admin thấy cảnh báo qua ErrorBell trước khi có ai bị chặn giữa chừng.
let driveWasHealthy = true;

async function checkDriveHealth() {
  try {
    await drive.about.get({ fields: 'user' });
    driveWasHealthy = true;
  } catch (err) {
    if (driveWasHealthy) {
      console.error('❌ [Drive] Health check thất bại — token có thể đã hết hạn/bị thu hồi:', err.message);
      logError({
        source:  'driveRoutes.healthCheck',
        message: 'Google Drive token đã hết hạn hoặc bị thu hồi — cần đăng nhập lại để cấp quyền mới! Chi tiết: ' + err.message,
        stack:   err.stack
      });
    }
    driveWasHealthy = false;
  }
}

setTimeout(checkDriveHealth, 10_000);
setInterval(checkDriveHealth, 6 * 60 * 60 * 1000);

// ── HELPER ────────────────────────────────────────────────────────────────────

// Nhận diện lỗi do token Drive hết hạn/bị thu hồi (khác các lỗi khác như file
// không tồn tại, mất mạng...) để trả thông báo dễ hiểu, đúng hướng xử lý.
function friendlyDriveError(err) {
  const code   = err.response?.data?.error || err.code;
  const isAuth = code === 'invalid_grant' || code === 401 || err.message?.includes('invalid_grant');
  return isAuth
    ? 'Google Drive token đã hết hạn hoặc bị thu hồi — cần Admin đăng nhập lại để cấp quyền mới! (' + err.message + ')'
    : err.message;
}

// Trả về null nếu storedPath (do client gửi lên) cố thoát ra ngoài STORAGE_ROOT
// (path traversal, vd "../../../.env") — so sánh kèm path.sep để tránh bị qua mặt
// bởi thư mục anh em cùng tiền tố (vd "STORAGE_ROOT_backup").
function resolveLocalPath(storedPath) {
  const cleaned      = storedPath.replace(/^Storage\//, '');
  const rootResolved = path.resolve(STORAGE_ROOT);
  const fullPath      = path.resolve(rootResolved, cleaned);
  if (fullPath !== rootResolved && !fullPath.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return fullPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drive/upload
// ─────────────────────────────────────────────────────────────────────────────

router.post('/upload', requireRoles(...APPROVE_ROLES), async (req, res) => {
  const { postId, storagePath, fileName } = req.body;

  if (!storagePath) return res.status(400).json({ error: 'Thiếu storagePath' });
  if (!FOLDER_ID)   return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID trong .env' });

  const localPath = resolveLocalPath(storagePath);
  if (!localPath) return res.status(400).json({ error: 'storagePath không hợp lệ' });

  console.log(`📤 [Drive] Upload | postId=${postId}`);
  console.log(`📂 [Drive] STORAGE_ROOT: ${path.resolve(STORAGE_ROOT)}`);
  console.log(`📂 [Drive] localPath: ${localPath}`);

  if (!fs.existsSync(localPath)) {
    return res.status(404).json({ error: `Không tìm thấy file trên VPS: ${localPath}` });
  }

  try {
    const uploadRes = await drive.files.create({
      requestBody: {
        name:     fileName || `BaiViet_${postId || Date.now()}`,
        mimeType: 'application/vnd.google-apps.document',
        parents:  [FOLDER_ID]
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body:     fs.createReadStream(localPath)
      },
      supportsAllDrives: true,
      fields: 'id, name'
    });

    const driveFileId = uploadRes.data.id;

    await drive.permissions.create({
      fileId:      driveFileId,
      requestBody: { role: 'writer', type: 'anyone' }
    });

    console.log(`✅ [Drive] Upload thành công | driveFileId=${driveFileId}`);

    res.json({
      success:     true,
      driveFileId,
      editUrl:     `https://docs.google.com/document/d/${driveFileId}/edit`,
      fileName:    uploadRes.data.name
    });

  } catch (err) {
    const friendly = friendlyDriveError(err);
    console.error('❌ [Drive] Upload lỗi:', friendly);
    logError({ source: 'driveRoutes.upload', message: friendly, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Lỗi upload Google Drive: ' + friendly });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drive/complete/:driveFileId
// Export từ Drive → ghi đè VPS → đổi StatusID=2 → push CTV → xóa Drive
// ─────────────────────────────────────────────────────────────────────────────

router.post('/complete/:driveFileId', requireRoles(...APPROVE_ROLES), async (req, res) => {
  const { driveFileId }         = req.params;
  const { postId, storagePath } = req.body;

  if (!driveFileId) return res.status(400).json({ error: 'Thiếu driveFileId' });
  if (!storagePath) return res.status(400).json({ error: 'Thiếu storagePath' });

  console.log(`📥 [Drive] Complete | driveFileId=${driveFileId} | postId=${postId}`);

  try {
    await drive.files.get({ fileId: driveFileId, fields: 'id' });
  } catch {
    return res.status(404).json({ error: 'File không còn tồn tại trên Google Drive!' });
  }

  const localPath = resolveLocalPath(storagePath);
  if (!localPath) return res.status(400).json({ error: 'storagePath không hợp lệ' });
  console.log(`📂 [Drive] Ghi đè tại: ${localPath}`);

  try {
    const exportRes = await drive.files.export(
      { fileId: driveFileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { responseType: 'stream' }
    );

    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    await new Promise((resolve, reject) => {
      const dest = fs.createWriteStream(localPath);
      exportRes.data.pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    console.log(`✅ [Drive] Đã ghi đè: ${localPath}`);

    if (postId) {
      try {
        const pool = await poolPromise;

        await pool.request()
          .input('id', postId)
          .query('UPDATE dbo.Posts SET StatusID = 2 WHERE PostID = @id');
        console.log(`✅ [Drive] PostID=${postId} → StatusID=2`);

        const postInfo = await pool.request()
          .input('id', postId)
          .query('SELECT AuthorID, Title FROM dbo.Posts WHERE PostID = @id');

        if (postInfo.recordset.length > 0) {
          const { AuthorID, Title } = postInfo.recordset[0];
          sendPushToUser(
            AuthorID,
            '✅ Bài viết đã được duyệt!',
            `"${Title}" đã được chỉnh sửa và phê duyệt. Tải về ngay!`,
            `/news/${postId}`
          ).catch(err => console.warn('⚠️ [Push] Gửi thông báo thất bại:', err.message));
          console.log(`📲 [Push] Đã gửi thông báo cho AuthorID=${AuthorID}`);

          // Fact-check corpus + hash-chain audit: dùng đúng bytes vừa ghi đè ở localPath và
          // 1 export text/plain riêng (docx export ở trên không đọc lại được dạng text thuần).
          try {
            const docxBuffer = fs.readFileSync(localPath);
            const textExportRes = await drive.files.export(
              { fileId: driveFileId, mimeType: 'text/plain' },
              { responseType: 'text' }
            );
            await afterApprove(pool, {
              postId, title: Title, contentBuffer: docxBuffer,
              approvedBy: req.user.UserID, source: 'drive-complete', ragText: textExportRes.data
            });
          } catch (auditErr) {
            logError({ source: 'driveRoutes.complete.afterApprove', message: auditErr.message, stack: auditErr.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
          }
        }

      } catch (dbErr) {
        // Trước đây lỗi này chỉ log rồi vẫn xóa file Drive + trả success:true — nếu DB lỗi
        // tạm thời (mất kết nối, deadlock) thì bài vẫn ở StatusID cũ (chưa duyệt) nhưng bản
        // gốc trên Drive đã mất, không còn cách thử lại, mà client vẫn thấy "thành công".
        // Giờ giữ nguyên file Drive (không xóa) và báo lỗi thật để bấm lại được — file trên
        // VPS đã ghi đè xong nên nội dung mới không mất, chỉ chưa đổi được trạng thái duyệt.
        console.warn('⚠️ [Drive] Cập nhật DB thất bại:', dbErr.message);
        logError({ source: 'driveRoutes.complete.dbUpdate', message: dbErr.message, stack: dbErr.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        return res.status(500).json({ error: 'Đã lưu file về VPS nhưng cập nhật trạng thái duyệt thất bại, vui lòng thử lại!' });
      }
    }

    try {
      await drive.files.delete({ fileId: driveFileId });
      console.log(`🗑️  [Drive] Đã xóa khỏi Drive: ${driveFileId}`);
    } catch (delErr) {
      console.warn('⚠️ [Drive] Xóa Drive thất bại:', delErr.message);
    }

    res.json({ success: true, storagePath, message: 'Đã lưu file về VPS và duyệt bài thành công!' });

  } catch (err) {
    const friendly = friendlyDriveError(err);
    console.error('❌ [Drive] Complete lỗi:', friendly);
    logError({ source: 'driveRoutes.complete', message: friendly, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Lỗi khi export file từ Drive: ' + friendly });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drive/diff/:driveFileId
// So sánh bản gốc CTV gửi (revision đầu tiên) với bản đang sửa (revision mới nhất) —
// CHỈ trong phạm vi 1 phiên sửa đang mở, vì file Drive bị xóa ngay sau khi hoàn tất
// duyệt (xem /complete) nên không có lịch sử đa phiên bản để so sánh xa hơn.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/diff/:driveFileId', requireRoles(...APPROVE_ROLES), async (req, res) => {
  const { driveFileId } = req.params;

  try {
    const revList = await drive.revisions.list({ fileId: driveFileId, fields: 'revisions(id, modifiedTime, exportLinks)' });
    const revisions = revList.data.revisions || [];
    if (revisions.length === 0) return res.status(404).json({ error: 'Chưa có phiên bản nào để so sánh.' });

    const first = revisions[0];
    const last  = revisions[revisions.length - 1];

    const { token } = await oauth2Client.getAccessToken();
    const fetchRevisionText = async (rev) => {
      const link = rev.exportLinks?.['text/plain'];
      if (!link) return '';
      const r = await fetch(link, { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.text() : '';
    };

    const [originalText, currentText] = await Promise.all([fetchRevisionText(first), fetchRevisionText(last)]);
    res.json({ originalText, currentText, singleRevision: first.id === last.id });

  } catch (err) {
    const friendly = friendlyDriveError(err);
    console.error('❌ [Drive] Diff lỗi:', friendly);
    logError({ source: 'driveRoutes.diff', message: friendly, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Lỗi khi lấy lịch sử phiên bản: ' + friendly });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drive/status/:driveFileId
// ─────────────────────────────────────────────────────────────────────────────

router.get('/status/:driveFileId', async (req, res) => {
  const { driveFileId } = req.params;
  try {
    const r = await drive.files.get({ fileId: driveFileId, fields: 'id, name, modifiedTime' });
    res.json({ exists: true, driveFileId, name: r.data.name, modifiedTime: r.data.modifiedTime, editUrl: `https://docs.google.com/document/d/${driveFileId}/edit` });
  } catch {
    res.json({ exists: false, driveFileId });
  }
});

module.exports = router;