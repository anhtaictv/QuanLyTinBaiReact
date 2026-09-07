// Chạy 1 lần (hoặc nhiều lần an toàn): thêm cột Posts.PhotoPath cho tính năng gửi nhanh
// ảnh hiện trường từ mobile, nếu chưa có.
const { poolPromise } = require('../config/db');

const columns = [
  { table: 'Posts', name: 'PhotoPath', sql: `ALTER TABLE dbo.Posts ADD PhotoPath NVARCHAR(500) NULL;` }
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

  console.log('Hoàn tất thêm cột PhotoPath.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi thêm cột PhotoPath:', err.message);
  process.exit(1);
});
