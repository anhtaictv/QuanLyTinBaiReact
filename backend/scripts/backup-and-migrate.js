// Chạy 1 lần: backup DB QuanLyTinBai + tạo bảng dbo.ErrorLogs nếu chưa có.
const { poolPromise } = require('../config/db');

(async () => {
  const pool = await poolPromise;
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const backupPath = `C:\\WebApp\\db_backups\\QuanLyTinBai_preupgrade_${ts}.bak`;

  console.log('Đang backup database...');
  await pool.request().query(`BACKUP DATABASE QuanLyTinBai TO DISK = N'${backupPath}' WITH INIT, NAME = N'QuanLyTinBai pre-upgrade backup'`);
  console.log('Backup DB xong:', backupPath);

  console.log('Đang tạo bảng dbo.ErrorLogs (nếu chưa có)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ErrorLogs' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
        CREATE TABLE dbo.ErrorLogs (
            ErrorID INT IDENTITY(1,1) PRIMARY KEY,
            Source NVARCHAR(100) NULL,
            Message NVARCHAR(MAX) NOT NULL,
            StackTrace NVARCHAR(MAX) NULL,
            UserID INT NULL,
            Method NVARCHAR(10) NULL,
            Path NVARCHAR(255) NULL,
            IsRead BIT NOT NULL DEFAULT 0,
            CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
        );
    END
  `);
  console.log('Bảng ErrorLogs OK.');

  process.exit(0);
})().catch(err => {
  console.error('Lỗi backup/migrate:', err.message);
  process.exit(1);
});
