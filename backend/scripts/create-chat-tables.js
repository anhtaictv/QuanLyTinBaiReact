// Chạy 1 lần (hoặc nhiều lần an toàn): tạo các bảng cho tính năng Chat nếu chưa có.
const { poolPromise } = require('../config/db');

const tables = [
  {
    name: 'Conversations',
    sql: `
      CREATE TABLE dbo.Conversations (
          ConversationID INT IDENTITY(1,1) PRIMARY KEY,
          IsGroup        BIT NOT NULL DEFAULT 0,
          Title          NVARCHAR(200) NULL,
          CreatedBy      INT NOT NULL,
          CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
          LastMessageAt  DATETIME NOT NULL DEFAULT GETDATE()
      );
    `
  },
  {
    name: 'ConversationMembers',
    sql: `
      CREATE TABLE dbo.ConversationMembers (
          ConversationMemberID INT IDENTITY(1,1) PRIMARY KEY,
          ConversationID    INT NOT NULL,
          UserID            INT NOT NULL,
          JoinedAt          DATETIME NOT NULL DEFAULT GETDATE(),
          IsAdmin           BIT NOT NULL DEFAULT 0,
          LastReadMessageID INT NULL,
          IsMuted           BIT NOT NULL DEFAULT 0
      );
    `
  },
  {
    name: 'Messages',
    sql: `
      CREATE TABLE dbo.Messages (
          MessageID      INT IDENTITY(1,1) PRIMARY KEY,
          ConversationID INT NOT NULL,
          SenderID       INT NOT NULL,
          Content        NVARCHAR(MAX) NULL,
          CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
          IsDeleted      BIT NOT NULL DEFAULT 0
      );
    `
  },
  {
    name: 'MessageAttachments',
    sql: `
      CREATE TABLE dbo.MessageAttachments (
          AttachmentID   INT IDENTITY(1,1) PRIMARY KEY,
          MessageID      INT NOT NULL,
          StoredPath     NVARCHAR(500) NOT NULL,
          OriginalName   NVARCHAR(255) NOT NULL,
          MimeType       NVARCHAR(100) NULL,
          SizeBytes      INT NULL,
          IsImage        BIT NOT NULL DEFAULT 0
      );
    `
  }
];

const indexes = [
  { name: 'UX_ConvMembers_Conv_User', table: 'ConversationMembers', sql: `CREATE UNIQUE INDEX UX_ConvMembers_Conv_User ON dbo.ConversationMembers(ConversationID, UserID);` },
  { name: 'IX_ConvMembers_User', table: 'ConversationMembers', sql: `CREATE INDEX IX_ConvMembers_User ON dbo.ConversationMembers(UserID);` },
  { name: 'IX_Messages_Conv_Created', table: 'Messages', sql: `CREATE INDEX IX_Messages_Conv_Created ON dbo.Messages(ConversationID, MessageID DESC);` },
  { name: 'IX_Attachments_Message', table: 'MessageAttachments', sql: `CREATE INDEX IX_Attachments_Message ON dbo.MessageAttachments(MessageID);` }
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

  console.log('Hoàn tất tạo bảng Chat.');
  process.exit(0);
})().catch(err => {
  console.error('Lỗi tạo bảng chat:', err.message);
  process.exit(1);
});
