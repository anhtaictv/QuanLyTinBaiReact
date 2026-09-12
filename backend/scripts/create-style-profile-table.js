// Chạy 1 lần (chạy lại nhiều lần vẫn an toàn): tạo bảng dbo.UserStyleProfiles — hồ sơ
// văn phong cá nhân do AI tự tóm tắt từ các bài đã duyệt của từng người, dùng làm ngữ
// cảnh thêm cho các module AI biên tập (xem utils/styleProfileBuilder.js). Không FK sang
// dbo.Users, cùng lý do với dbo.Tasks/dbo.NewsDigestItems: xoá tài khoản không nên bị
// chặn bởi 1 dòng hồ sơ văn phong mồ côi.
const { poolPromise } = require('../config/db');

// Xem create-tasks-table.js: DDL trên VPS này đo thực tế chậm hơn hẳn 15s mặc định.
const DDL_TIMEOUT_MS = 120000;

async function runDdl(pool, sqlText) {
  const request = pool.request();
  request.timeout = DDL_TIMEOUT_MS;
  return request.query(sqlText);
}

(async () => {
  const pool = await poolPromise;

  console.log('Đang tạo bảng dbo.UserStyleProfiles (nếu chưa có)...');
  await runDdl(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserStyleProfiles' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.UserStyleProfiles (
          UserID          INT NOT NULL PRIMARY KEY,
          ProfileText     NVARCHAR(MAX) NOT NULL,
          -- Số bài đã dùng để tạo bản tóm tắt gần nhất — hiển thị cho người dùng biết hồ
          -- sơ dựa trên bao nhiêu dữ liệu, không dùng để tính toán gì thêm.
          SourcePostCount INT NOT NULL,
          -- 1 = người dùng đã tự sửa tay hồ sơ — đợt auto-refresh định kỳ
          -- (scripts/update-style-profiles.js) phải bỏ qua, không ghi đè mất bản sửa tay.
          IsLocked        BIT NOT NULL CONSTRAINT DF_UserStyleProfiles_IsLocked DEFAULT 0,
          UpdatedAt       DATETIME NOT NULL CONSTRAINT DF_UserStyleProfiles_UpdatedAt DEFAULT GETUTCDATE()
      );
    END
  `);
  console.log('Bảng UserStyleProfiles OK.');

  // Phòng trường hợp bảng đã được tạo từ bản script cũ (trước khi có cột IsLocked) —
  // thêm cột nếu thiếu, cùng cách add-photo-path-to-posts.js đã làm cho dbo.Posts.
  console.log('Kiểm tra cột IsLocked (nếu chưa có)...');
  await runDdl(pool, `
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.UserStyleProfiles') AND name = 'IsLocked'
    )
    BEGIN
      ALTER TABLE dbo.UserStyleProfiles ADD IsLocked BIT NOT NULL CONSTRAINT DF_UserStyleProfiles_IsLocked DEFAULT 0;
    END
  `);
  console.log('Cột IsLocked OK.');

  console.log('Xong. Module hồ sơ văn phong đã có bảng để chạy.');
  process.exit(0);
})().catch(err => {
  console.error('Tạo bảng UserStyleProfiles thất bại:', err.message);
  process.exit(1);
});
