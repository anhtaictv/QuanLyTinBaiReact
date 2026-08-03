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
  const userID   = req.user?.UserID;
  const endpoint = subscription?.endpoint;

  if (!subscription || !userID || !endpoint) {
    return res.status(400).json({ error: 'Thiếu subscription hoặc userID' });
  }

  try {
    const pool = await poolPromise;

    // Upsert theo (UserID, endpoint) — 1 dòng/thiết bị, không phải 1 dòng/user. Trước đây
    // khoá theo UserID nên bật thông báo ở thiết bị thứ 2 ghi đè mất subscription của thiết
    // bị đầu (endpoint là URL duy nhất do trình duyệt cấp cho mỗi lần đăng ký push).
    const existing = await pool.request()
      .input('UserID', userID)
      .input('Endpoint', endpoint)
      .query("SELECT SubscriptionID FROM dbo.PushSubscriptions WHERE UserID = @UserID AND JSON_VALUE(Subscription, '$.endpoint') = @Endpoint");

    const subStr = JSON.stringify(subscription);

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('SubscriptionID', existing.recordset[0].SubscriptionID)
        .input('Subscription',  subStr)
        .query('UPDATE dbo.PushSubscriptions SET Subscription = @Subscription, UpdatedAt = GETDATE() WHERE SubscriptionID = @SubscriptionID');
    } else {
      try {
        await pool.request()
          .input('UserID',       userID)
          .input('Subscription', subStr)
          .query('INSERT INTO dbo.PushSubscriptions (UserID, Subscription, CreatedAt, UpdatedAt) VALUES (@UserID, @Subscription, GETDATE(), GETDATE())');
      } catch (err) {
        // Trùng UX_PushSubscriptions_EndpointHash — request khác đã insert đúng endpoint này
        // ngay trước (2 tab mở cùng lúc bấm bật thông báo) — coi như đã lưu, không phải lỗi.
        if (!/violat|duplicate|unique/i.test(err.message)) throw err;
      }
    }

    console.log(`✅ [Push] Đã lưu subscription cho UserID=${userID}`);
    res.json({ success: true });

  } catch (err) {
    console.error('❌ [Push] Subscribe lỗi:', err.message);
    logError({ source: 'pushRoutes.subscribe', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/push/unsubscribe
// Xóa subscription khi user tắt thông báo
// ─────────────────────────────────────────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  const userID   = req.user?.UserID;
  const endpoint = req.body?.endpoint;
  try {
    const pool = await poolPromise;
    if (endpoint) {
      // Chỉ xoá subscription của ĐÚNG thiết bị đang tắt thông báo — trước đây xoá theo
      // UserID nên tắt thông báo ở 1 máy tắt luôn cho mọi thiết bị khác của cùng user.
      await pool.request()
        .input('UserID', userID)
        .input('Endpoint', endpoint)
        .query("DELETE FROM dbo.PushSubscriptions WHERE UserID = @UserID AND JSON_VALUE(Subscription, '$.endpoint') = @Endpoint");
    }
    // Không có endpoint (thiết bị này chưa từng đăng ký) — không có gì để xoá, và không
    // đoán xoá hộ thiết bị khác.
    res.json({ success: true });
  } catch (err) {
    logError({ source: 'pushRoutes.unsubscribe', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
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
      .query('SELECT SubscriptionID, Subscription FROM dbo.PushSubscriptions WHERE UserID = @UserID');

    if (!result.recordset.length) {
      console.log(`ℹ️  [Push] UserID=${userID} chưa đăng ký subscription`);
      return;
    }

    const payload = JSON.stringify({ title, body, url, icon: '/logo192.png' });

    // 1 user có thể có nhiều dòng (nhiều thiết bị) — gửi tới TẤT CẢ, không chỉ dòng đầu.
    for (const row of result.recordset) {
      try {
        const subscription = JSON.parse(row.Subscription);
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ [Push] Đã gửi thông báo cho UserID=${userID} (SubscriptionID=${row.SubscriptionID}): ${title}`);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Chỉ xoá ĐÚNG subscription hết hạn này — trước đây xoá theo UserID, nên 1 thiết
          // bị hết hạn làm mất luôn đăng ký push của các thiết bị khác vẫn còn hoạt động.
          console.log(`🗑️  [Push] Subscription hết hạn, xóa SubscriptionID=${row.SubscriptionID}`);
          try {
            await pool.request()
              .input('SubscriptionID', row.SubscriptionID)
              .query('DELETE FROM dbo.PushSubscriptions WHERE SubscriptionID = @SubscriptionID');
          } catch {}
        } else {
          console.error(`❌ [Push] Gửi thất bại cho UserID=${userID} (SubscriptionID=${row.SubscriptionID}):`, err.message);
        }
      }
    }
  } catch (err) {
    console.error(`❌ [Push] sendPushToUser lỗi cho UserID=${userID}:`, err.message);
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

    // Lấy tất cả user có role trong danh sách và đã đăng ký subscription (có thể nhiều
    // dòng/user do nhiều thiết bị)
    const result = await request.query(`
        SELECT ps.SubscriptionID, ps.UserID, ps.Subscription
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
          // Xoá đúng SubscriptionID hỏng — trước đây xoá theo UserID nên 1 thiết bị hết hạn
          // làm mất đăng ký push của các thiết bị khác cùng user.
          await pool.request()
            .input('SubscriptionID', row.SubscriptionID)
            .query('DELETE FROM dbo.PushSubscriptions WHERE SubscriptionID = @SubscriptionID');
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