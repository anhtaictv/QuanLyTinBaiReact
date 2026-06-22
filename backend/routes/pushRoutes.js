const express      = require('express');
const router       = express.Router();
const webpush      = require('web-push');
const { poolPromise, sql } = require('../config/db');
const { logError } = require('../utils/errorLogger');

// VAPID keys – tạo 1 lần bằng: npx web-push generate-vapid-keys
// Lưu vào .env
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@qltin.local'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/push/subscribe
// Lưu subscription token của user vào DB
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  const userID = req.user?.UserID;

  if (!subscription || !userID) {
    return res.status(400).json({ error: 'Thiếu subscription hoặc userID' });
  }

  try {
    const pool = await poolPromise;

    // Upsert: nếu đã có thì cập nhật, chưa có thì thêm mới
    const existing = await pool.request()
      .input('UserID', userID)
      .query('SELECT SubscriptionID FROM dbo.PushSubscriptions WHERE UserID = @UserID');

    const subStr = JSON.stringify(subscription);

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('UserID',       userID)
        .input('Subscription', subStr)
        .query('UPDATE dbo.PushSubscriptions SET Subscription = @Subscription, UpdatedAt = GETDATE() WHERE UserID = @UserID');
    } else {
      await pool.request()
        .input('UserID',       userID)
        .input('Subscription', subStr)
        .query('INSERT INTO dbo.PushSubscriptions (UserID, Subscription, CreatedAt, UpdatedAt) VALUES (@UserID, @Subscription, GETDATE(), GETDATE())');
    }

    console.log(`✅ [Push] Đã lưu subscription cho UserID=${userID}`);
    res.json({ success: true });

  } catch (err) {
    console.error('❌ [Push] Subscribe lỗi:', err.message);
    logError({ source: 'pushRoutes.subscribe', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/push/unsubscribe
// Xóa subscription khi user tắt thông báo
// ─────────────────────────────────────────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  const userID = req.user?.UserID;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('UserID', userID)
      .query('DELETE FROM dbo.PushSubscriptions WHERE UserID = @UserID');
    res.json({ success: true });
  } catch (err) {
    logError({ source: 'pushRoutes.unsubscribe', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/push/vapidPublicKey
// Frontend lấy public key để đăng ký subscription
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Gửi push đến 1 user theo UserID
// Dùng nội bộ trong createNews và driveRoutes
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushToUser(userID, title, body, url = '/news') {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input('UserID', userID)
      .query('SELECT Subscription FROM dbo.PushSubscriptions WHERE UserID = @UserID');

    if (!result.recordset.length) {
      console.log(`ℹ️  [Push] UserID=${userID} chưa đăng ký subscription`);
      return;
    }

    const subscription = JSON.parse(result.recordset[0].Subscription);
    const payload      = JSON.stringify({ title, body, url, icon: '/logo192.png' });

    await webpush.sendNotification(subscription, payload);
    console.log(`✅ [Push] Đã gửi thông báo cho UserID=${userID}: ${title}`);

  } catch (err) {
    // Subscription hết hạn → xóa khỏi DB
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`🗑️  [Push] Subscription hết hạn, xóa UserID=${userID}`);
      try {
        const pool = await poolPromise;
        await pool.request()
          .input('UserID', userID)
          .query('DELETE FROM dbo.PushSubscriptions WHERE UserID = @UserID');
      } catch {}
    } else {
      console.error(`❌ [Push] Gửi thất bại cho UserID=${userID}:`, err.message);
    }
  }
}

// Gửi push đến tất cả người có role cụ thể
async function sendPushToRoles(roles, title, body, url = '/news') {
  try {
    const pool    = await poolPromise;
    const request = pool.request();
    const placeholders = roles.map((r, i) => {
      request.input(`role${i}`, r.toLowerCase());
      return `@role${i}`;
    });

    // Lấy tất cả user có role trong danh sách và đã đăng ký subscription
    const result = await request.query(`
        SELECT ps.UserID, ps.Subscription
        FROM dbo.PushSubscriptions ps
        JOIN dbo.Users u ON ps.UserID = u.UserID
        WHERE LOWER(u.Role) IN (${placeholders.join(',')})
      `);

    for (const row of result.recordset) {
      try {
        const subscription = JSON.parse(row.Subscription);
        const payload      = JSON.stringify({ title, body, url, icon: '/logo192.png' });
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ [Push] Đã gửi cho UserID=${row.UserID}`);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.request()
            .input('UserID', row.UserID)
            .query('DELETE FROM dbo.PushSubscriptions WHERE UserID = @UserID');
        }
      }
    }
  } catch (err) {
    console.error('❌ [Push] sendPushToRoles lỗi:', err.message);
  }
}

module.exports = router;
module.exports.sendPushToUser  = sendPushToUser;
module.exports.sendPushToRoles = sendPushToRoles;