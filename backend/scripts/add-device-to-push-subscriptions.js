// Chạy 1 lần (hoặc nhiều lần an toàn): thêm chỉ mục hỗ trợ 1 user có NHIỀU dòng
// PushSubscriptions (nhiều thiết bị) — trước đây code luôn thao tác theo UserID nên
// bật thông báo ở thiết bị thứ 2 âm thầm ghi đè/tắt thông báo thiết bị đầu.
// EndpointHash là cột computed từ chính JSON Subscription đã có sẵn (giống LinkHash
// ở NewsDigestItems) — không cần cột dữ liệu mới, không cần backfill tay, các dòng cũ
// tự có giá trị đúng ngay khi thêm cột.
const { poolPromise } = require('../config/db');

(async () => {
  const pool = await poolPromise;

  console.log('Đang thêm cột EndpointHash (định danh thiết bị theo endpoint) nếu chưa có...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PushSubscriptions') AND name = 'EndpointHash')
    BEGIN
      ALTER TABLE dbo.PushSubscriptions
      ADD EndpointHash AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', JSON_VALUE(Subscription, '$.endpoint'))) PERSISTED;
    END
  `);
  console.log('Cột EndpointHash OK.');

  console.log('Đang tạo unique index chống trùng subscription theo endpoint...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PushSubscriptions_EndpointHash' AND object_id = OBJECT_ID('dbo.PushSubscriptions'))
    BEGIN
      CREATE UNIQUE INDEX UX_PushSubscriptions_EndpointHash ON dbo.PushSubscriptions(EndpointHash) WHERE EndpointHash IS NOT NULL;
    END
  `);
  console.log('Index UX_PushSubscriptions_EndpointHash OK.');

  console.log('Hoàn tất — PushSubscriptions giờ hỗ trợ nhiều thiết bị/user.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi migrate PushSubscriptions:', err.message);
  process.exit(1);
});
