const { google } = require('googleapis');
const http        = require('http');
const fs          = require('fs');
const path        = require('path');

const creds = require('./oauth-credentials.json');

// oauth-credentials.json khai redirect_uris: ["http://localhost"] (client kiểu
// Desktop app) — Google đã ngừng chấp nhận flow "oob" (copy-paste code thủ
// công, urn:ietf:wg:oauth:2.0:oob) cho các client mới, trả lỗi "invalid_request".
// Dùng đúng flow loopback: mở server tạm trên localhost, Google tự redirect
// code về đây sau khi người dùng đồng ý cấp quyền trên trình duyệt.
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const code   = reqUrl.searchParams.get('code');
  const err    = reqUrl.searchParams.get('error');

  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Google báo lỗi: ${err}</h2>`);
    console.error('❌ Google trả lỗi:', err);
    server.close(() => process.exit(1));
    return;
  }
  if (!code) {
    res.writeHead(200); res.end('Đang chờ...'); // request khác (favicon...), bỏ qua
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h2>✅ Đã nhận code, có thể đóng tab này.</h2>');

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // driveRoutes.js ưu tiên đọc google-token.json nếu file này tồn tại (xem
    // loadToken()), nên ghi thẳng vào đây để có hiệu lực ngay sau khi restart.
    const tokenPath = path.join(__dirname, 'google-token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    console.log('\n✅ Đã lưu token mới vào', tokenPath);
    console.log('   Refresh token:', tokens.refresh_token);
    console.log('\nChạy "pm2 restart qltin-backend" để backend nạp token mới.');
  } catch (e) {
    console.error('❌ Lỗi khi đổi code lấy token:', e.message);
  } finally {
    server.close(() => process.exit(0));
  }
});

let oauth2Client;

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;

  oauth2Client = new google.auth.OAuth2(
    creds.installed.client_id,
    creds.installed.client_secret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive']
  });

  console.log(`Đang chờ trên ${redirectUri} ...`);
  console.log('\nMở link này TRÊN TRÌNH DUYỆT CỦA MÁY NÀY (không phải máy khác qua remote):\n');
  console.log(authUrl);
});
