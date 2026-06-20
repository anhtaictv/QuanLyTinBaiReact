const { google } = require('googleapis');
const readline   = require('readline');

const creds = require('./oauth-credentials.json');
const oauth2Client = new google.auth.OAuth2(
  creds.installed.client_id,
  creds.installed.client_secret,
  'urn:ietf:wg:oauth:2.0:oob'
);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive']
});

console.log('Mở link này trên trình duyệt:\n', url);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nNhập code từ trình duyệt: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n✅ REFRESH TOKEN:\n', tokens.refresh_token);
  console.log('\nCopy refresh_token vào .env');
  rl.close();
});