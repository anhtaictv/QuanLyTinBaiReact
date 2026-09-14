// Chạy 1 lần (hoặc nhiều lần an toàn): tạo bảng PostApprovalAudit (hash-chain chống sửa
// ngầm bài viết đã duyệt) nếu chưa có.
const { poolPromise } = require('../config/db');

const tables = [
  {
    name: 'PostApprovalAudit',
    sql: `
      CREATE TABLE dbo.PostApprovalAudit (
          AuditID       INT IDENTITY(1,1) PRIMARY KEY,
          PostID        INT NOT NULL,
          Title         NVARCHAR(500) NOT NULL,
          ContentHash   CHAR(64) NOT NULL,
          PrevChainHash CHAR(64) NULL,
          ChainHash     CHAR(64) NOT NULL,
          ApprovedBy    INT NOT NULL,
          ApprovedAt    DATETIME NOT NULL DEFAULT GETDATE(),
          Source        NVARCHAR(30) NOT NULL
      );
    `
  }
];

const indexes = [
  { name: 'IX_PostApprovalAudit_Post', table: 'PostApprovalAudit', sql: `CREATE INDEX IX_PostApprovalAudit_Post ON dbo.PostApprovalAudit(PostID, AuditID DESC);` }
];

(async () => {
  const pool = await poolPromise;

  for (const t of tables) {
    console.log(`Đang tạo bảng dbo.${t.name} (nếu chưa có)...`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '${t.name}' AND schema_id = SCHEMA_ID('dbo'))
      BEGIN
        ${t.sql}
      END
    `);
    console.log(`Bảng ${t.name} OK.`);
  }

  for (const idx of indexes) {
    console.log(`Đang tạo index ${idx.name} (nếu chưa có)...`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${idx.name}' AND object_id = OBJECT_ID('dbo.${idx.table}'))
      BEGIN
        ${idx.sql}
      END
    `);
    console.log(`Index ${idx.name} OK.`);
  }

  console.log('Hoàn tất tạo bảng PostApprovalAudit.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi tạo bảng PostApprovalAudit:', err.message);
  process.exit(1);
});
