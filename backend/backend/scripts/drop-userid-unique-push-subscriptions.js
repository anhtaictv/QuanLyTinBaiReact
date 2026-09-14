// Chạy 1 lần (hoặc nhiều lần an toàn): xóa ràng buộc UNIQUE cũ trên riêng cột UserID của
// dbo.PushSubscriptions — sót lại từ trước khi hỗ trợ nhiều thiết bị/user (xem
// add-device-to-push-subscriptions.js). Code ở routes/pushRoutes.js đã coi 1 user có thể
// có NHIỀU dòng (1 dòng/thiết bị, khoá theo endpoint), nhưng ràng buộc UNIQUE(UserID) sót
// lại vẫn chặn ở tầng DB — user bật thông báo ở thiết bị thứ 2 bị lỗi:
// "Violation of UNIQUE KEY constraint 'UQ__PushSubs__...'. The duplicate key value is (2)."
// Tên ràng buộc do SQL Server tự sinh (hash ngẫu nhiên) nên phải tra động qua system
// catalog, không hardcode được tên.
const { poolPromise } = require('../config/db');

(async () => {
  const pool = await poolPromise;

  console.log('Đang tìm ràng buộc UNIQUE cũ chỉ trên cột UserID của dbo.PushSubscriptions...');

  // Chỉ khớp ràng buộc UNIQUE có ĐÚNG 1 cột và cột đó là UserID — tránh xóa nhầm ràng buộc
  // unique khác (nếu sau này có) trên nhiều cột.
  const result = await pool.request().query(`
    SELECT kc.name AS ConstraintName
    FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.PushSubscriptions')
      AND kc.type = 'UQ'
      AND (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id) = 1
      AND EXISTS (
        SELECT 1 FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id AND c.name = 'UserID'
      )
  `);

  const constraintName = result.recordset[0]?.ConstraintName;

  if (!constraintName) {
    console.log('Không tìm thấy ràng buộc UNIQUE(UserID) nào cần xóa — có thể đã xóa rồi. OK.');
  } else {
    console.log(`Đang xóa ràng buộc ${constraintName}...`);
    await pool.request().query(`ALTER TABLE dbo.PushSubscriptions DROP CONSTRAINT [${constraintName}]`);
    console.log(`Đã xóa ràng buộc ${constraintName}.`);
  }

  console.log('Hoàn tất — PushSubscriptions giờ cho phép nhiều dòng/user (nhiều thiết bị) ở tầng DB.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi xóa ràng buộc UNIQUE(UserID) PushSubscriptions:', err.message);
  process.exit(1);
});
