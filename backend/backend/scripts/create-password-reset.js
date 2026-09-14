// Chạy 1 lần (hoặc nhiều lần an toàn): thêm cột Email vào Users + tạo bảng
// PasswordResetTokens cho tính năng "Quên mật khẩu".
const { poolPromise } = require('../config/db');

const columns = [
  {
    table: 'Users',
    name: 'Email',
    sql: `ALTER TABLE dbo.Users ADD Email NVARCHAR(255) NULL;`
  }
];

const tables = [
  {
    name: 'PasswordResetTokens',
    sql: `
      CREATE TABLE dbo.PasswordResetTokens (
          ResetID   INT IDENTITY(1,1) PRIMARY KEY,
          UserID    INT NOT NULL,
          TokenHash CHAR(64) NOT NULL,
          ExpiresAt DATETIME NOT NULL,
          Used      BIT NOT NULL DEFAULT 0,
          CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
      );
    `
  }
];

const indexes = [
  {
    name: 'IX_PasswordResetTokens_TokenHash',
    table: 'PasswordResetTokens',
    sql: `CREATE INDEX IX_PasswordResetTokens_TokenHash ON dbo.PasswordResetTokens (TokenHash);`
  }
];

(async () => {
  const pool = await poolPromise;

  for (const col of columns) {
    console.log(`Đang thêm cột ${col.table}.${col.name} (nếu chưa có)...`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${col.table}') AND name = '${col.name}')
      BEGIN
        ${col.sql}
      END
    `);
    console.log(`Cột ${col.table}.${col.name} OK.`);
  }

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

  console.log('Hoàn tất migration Quên mật khẩu.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi migration:', err.message);
  process.exit(1);
});
