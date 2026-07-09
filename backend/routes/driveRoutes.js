const express  = require('express');
const router   = express.Router();
const { google } = require('googleapis');
const fs       = require('fs');
const path     = require('path');
const { poolPromise } = require('../config/db');
const { sendPushToUser } = require('./pushRoutes');
const { logError } = require('../utils/errorLogger');

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

router.post('/upload', async (req, res) => {
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

router.post('/complete/:driveFileId', async (req, res) => {
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
        }

      } catch (dbErr) {
        console.warn('⚠️ [Drive] Cập nhật DB thất bại:', dbErr.message);
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