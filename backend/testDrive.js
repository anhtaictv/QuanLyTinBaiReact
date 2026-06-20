const { google } = require('googleapis');
const path = require('path');
const fs   = require('fs');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function test() {
  console.log('=== KIỂM TRA GOOGLE DRIVE ===\n');

  // 1. Thông tin Service Account
  const about = await drive.about.get({ fields: 'user, storageQuota' });
  console.log('👤 Email:', about.data.user.emailAddress);
  console.log('💾 Đã dùng:', Math.round(about.data.storageQuota.usage / 1024 / 1024), 'MB');
  console.log('💾 Tổng:', about.data.storageQuota.limit
    ? Math.round(about.data.storageQuota.limit / 1024 / 1024) + ' MB'
    : 'Không giới hạn (Shared Drive)');

  // 2. Kiểm tra folder
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log('\n📁 FOLDER_ID:', FOLDER_ID);
  const folder = await drive.files.get({
    fileId: FOLDER_ID,
    fields: 'id, name, owners, driveId',
    supportsAllDrives: true
  });
  console.log('✅ Folder name:', folder.data.name);
  console.log('👤 Folder owners:', JSON.stringify(folder.data.owners));
  console.log('🚗 driveId (nếu là Shared Drive):', folder.data.driveId || 'Không có - là My Drive thường');

  // 3. Thử upload file nhỏ test
  console.log('\n📤 Thử upload file test...');
  const testContent = Buffer.from('Test file content');
  const { Readable } = require('stream');
  const stream = Readable.from(testContent);

  const uploadRes = await drive.files.create({
    requestBody: {
      name:    'TEST_DELETE_ME.txt',
      parents: [FOLDER_ID]
    },
    media: {
      mimeType: 'text/plain',
      body:     stream
    },
    supportsAllDrives: true,
    fields: 'id, name, owners'
  });

  console.log('✅ Upload thành công! fileId:', uploadRes.data.id);
  console.log('👤 File owner:', JSON.stringify(uploadRes.data.owners));

  // Xóa file test
  await drive.files.delete({ fileId: uploadRes.data.id, supportsAllDrives: true });
  console.log('🗑️  Đã xóa file test');
  console.log('\n✅ MỌI THỨ HOẠT ĐỘNG BÌNH THƯỜNG!');
}

test().catch(err => {
  console.error('\n❌ LỖI:', err.message);
  if (err.message.includes('quota')) {
    console.log('\n💡 Gợi ý: Service Account đang upload vào Drive của chính nó (giới hạn 15GB)');
    console.log('   Cần tạo Shared Drive và thêm Service Account vào đó.');
  }
});