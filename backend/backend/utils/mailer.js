const nodemailer = require('nodemailer');

// Dùng Gmail + App Password (không phải mật khẩu Gmail thường - tạo tại
// https://myaccount.google.com/apppasswords, cần bật 2-Step Verification trước).
// transporter là null nếu chưa cấu hình - sendResetPasswordEmail() sẽ tự báo lỗi rõ
// ràng thay vì crash, giống cách Telegram/VAPID optional khác trong project.
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
}

async function sendResetPasswordEmail(toEmail, resetUrl) {
    if (!transporter) {
        throw new Error('Chưa cấu hình GMAIL_USER/GMAIL_APP_PASSWORD trong .env');
    }

    await transporter.sendMail({
        from: `"Quản Lý Tin Bài" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: 'Đặt lại mật khẩu - Quản Lý Tin Bài',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #C1602E;">Đặt lại mật khẩu</h2>
                <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản Quản Lý Tin Bài của bạn.</p>
                <p>Bấm vào nút dưới đây để đặt mật khẩu mới. Link có hiệu lực trong <strong>30 phút</strong>.</p>
                <p style="margin: 24px 0;">
                    <a href="${resetUrl}" style="background:#C1602E; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600;">Đặt lại mật khẩu</a>
                </p>
                <p style="color:#888; font-size:13px;">Nếu bạn không yêu cầu điều này, hãy bỏ qua email này - mật khẩu của bạn sẽ không bị thay đổi.</p>
            </div>
        `,
    });
}

module.exports = { sendResetPasswordEmail };
