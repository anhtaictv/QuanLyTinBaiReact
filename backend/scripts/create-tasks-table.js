// Chạy 1 lần (chạy lại nhiều lần vẫn an toàn): tạo bảng giao việc dbo.Tasks cho module
// "Lịch công việc". Cố ý KHÔNG đặt FOREIGN KEY sang dbo.Users — giống các bảng chat/
// news-digest đang chạy: có FK thì lệnh xoá tài khoản (DELETE /api/users/:id) sẽ chết
// vì còn việc cũ tham chiếu, mà lịch sử giao việc thì nên giữ lại kể cả khi người đó
// nghỉ. Tên người hiển thị luôn JOIN lúc đọc chứ không lưu bản sao trong bảng này.
const { poolPromise } = require('../config/db');

// Mặc định của mssql là 15s, mà DDL trên VPS này đo thực tế mất ~10s cho riêng lệnh
// CREATE TABLE — sát trần đến mức lần chạy đầu đã trượt vì "Request failed to complete
// in 15000ms" trong khi bảng thì vẫn đang được tạo dở. Nới hẳn lên cho chắc.
const DDL_TIMEOUT_MS = 120000;

async function runDdl(pool, sqlText) {
  const request = pool.request();
  request.timeout = DDL_TIMEOUT_MS;
  return request.query(sqlText);
}

(async () => {
  const pool = await poolPromise;

  console.log('Đang tạo bảng dbo.Tasks (nếu chưa có)...');
  await runDdl(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tasks' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.Tasks (
          TaskID      INT IDENTITY(1,1) PRIMARY KEY,
          Title       NVARCHAR(300) NOT NULL,
          Description NVARCHAR(MAX) NULL,
          -- AssignerID: người giao. AssigneeID: người nhận việc.
          AssignerID  INT NOT NULL,
          AssigneeID  INT NOT NULL,
          -- Bài viết liên quan (dbo.Posts), để trống được: giao việc hành chính thì không gắn bài nào.
          PostID      INT NULL,
          -- Mã ASCII ('pending' | 'in_progress' | 'done'), KHÔNG lưu nhãn tiếng Việt:
          -- trạng thái được so khớp trong WHERE và trong test, dấu tiếng Việt chỉ tổ sinh
          -- lỗi collation khó lần. Nhãn hiển thị nằm ở utils/taskStatus.js hai phía.
          Status      VARCHAR(20) NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT 'pending',
          -- AssignedAt = lúc giao việc (chính là "thời gian nhận việc" trên giao diện).
          AssignedAt  DATETIME NOT NULL CONSTRAINT DF_Tasks_AssignedAt DEFAULT GETUTCDATE(),
          DueAt       DATETIME NULL,
          StartedAt   DATETIME NULL,
          CompletedAt DATETIME NULL,
          UpdatedAt   DATETIME NOT NULL CONSTRAINT DF_Tasks_UpdatedAt DEFAULT GETUTCDATE()
      );
    END
  `);
  console.log('Bảng Tasks OK.');

  // Hai truy vấn nóng nhất là "việc của tôi trong tháng" và "việc tôi đã giao trong
  // tháng", cả hai đều lọc theo người rồi mới tới khoảng ngày — nên index ghép theo
  // đúng thứ tự đó.
  const indexes = [
    { name: 'IX_Tasks_Assignee_Due', sql: 'CREATE INDEX IX_Tasks_Assignee_Due ON dbo.Tasks(AssigneeID, DueAt);' },
    { name: 'IX_Tasks_Assigner_Assigned', sql: 'CREATE INDEX IX_Tasks_Assigner_Assigned ON dbo.Tasks(AssignerID, AssignedAt DESC);' },
    { name: 'IX_Tasks_Post', sql: 'CREATE INDEX IX_Tasks_Post ON dbo.Tasks(PostID) WHERE PostID IS NOT NULL;' }
  ];

  for (const idx of indexes) {
    console.log(`Đang tạo index ${idx.name} (nếu chưa có)...`);
    await runDdl(pool, `
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${idx.name}' AND object_id = OBJECT_ID('dbo.Tasks'))
      BEGIN
        ${idx.sql}
      END
    `);
  }
  console.log('Index Tasks OK.');

  console.log('Xong. Module Lịch công việc đã có bảng để chạy.');
  process.exit(0);
})().catch(err => {
  console.error('Tạo bảng Tasks thất bại:', err.message);
  process.exit(1);
});
