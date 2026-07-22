// Chạy 1 lần (hoặc nhiều lần an toàn): tạo bảng lưu tin tổng hợp từ RSS báo chí cho
// tab "Tổng hợp tin địa phương" nếu chưa có.
const { poolPromise } = require('../config/db');

(async () => {
  const pool = await poolPromise;

  console.log('Đang tạo bảng dbo.NewsDigestItems (nếu chưa có)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NewsDigestItems' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.NewsDigestItems (
          ItemID      INT IDENTITY(1,1) PRIMARY KEY,
          Title       NVARCHAR(500) NOT NULL,
          Link        NVARCHAR(1000) NOT NULL,
          -- Link dài ngắn tuỳ ý (query string...), NVARCHAR(1000) vượt giới hạn 900 byte cho
          -- index key thường — băm ra cột cố định 32 byte riêng để đánh unique index, tránh lỗi
          -- "key too large" khi có URL dài mà vẫn chống trùng đúng theo Link.
          LinkHash    AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', Link)) PERSISTED,
          SourceName  NVARCHAR(200) NOT NULL,
          Summary     NVARCHAR(MAX) NULL,
          Keyword     NVARCHAR(100) NULL,
          PublishedAt DATETIME NULL,
          FetchedAt   DATETIME NOT NULL DEFAULT GETUTCDATE()
      );
    END
  `);
  console.log('Bảng NewsDigestItems OK.');

  console.log('Đang tạo unique index chống trùng bài theo Link...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_NewsDigestItems_LinkHash' AND object_id = OBJECT_ID('dbo.NewsDigestItems'))
    BEGIN
      CREATE UNIQUE INDEX UX_NewsDigestItems_LinkHash ON dbo.NewsDigestItems(LinkHash);
    END
  `);
  console.log('Index UX_NewsDigestItems_LinkHash OK.');

  console.log('Đang tạo index hỗ trợ sắp xếp theo ngày đăng...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NewsDigestItems_PublishedAt' AND object_id = OBJECT_ID('dbo.NewsDigestItems'))
    BEGIN
      CREATE INDEX IX_NewsDigestItems_PublishedAt ON dbo.NewsDigestItems(PublishedAt DESC);
    END
  `);
  console.log('Index IX_NewsDigestItems_PublishedAt OK.');

  console.log('Hoàn tất tạo bảng NewsDigestItems.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi tạo bảng NewsDigestItems:', err.message);
  process.exit(1);
});
