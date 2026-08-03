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

  // ponytail: SQL Server không cho filtered index (WHERE EndpointHash IS NOT NULL) tham
  // chiếu computed column trong biểu thức filter — bỏ qua unique index, chỉ dựa vào
  // SELECT-trước-khi-insert trong routes/pushRoutes.js (đã có) để chống trùng. Race hiếm
  // (2 request subscribe cùng lúc từ đúng 1 thiết bị) có thể tạo dư 1 dòng, không phải lỗi
  // nghiêm trọng — nâng cấp lên unique index nếu sau này cần chống race tuyệt đối.

  console.log('Hoàn tất — PushSubscriptions giờ hỗ trợ nhiều thiết bị/user.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi migrate PushSubscriptions:', err.message);
  process.exit(1);
});
