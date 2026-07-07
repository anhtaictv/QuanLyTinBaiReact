// Backup DB tự động hàng ngày — chạy qua Windows Task Scheduler (SQL Server Express
// không có SQL Server Agent nên không lập job được ngay trong SQL Server).
// Giữ lại RETENTION_DAYS bản backup gần nhất, tự xoá bản cũ hơn để không phình đĩa.
const fs   = require('fs');
const path = require('path');
const { poolPromise, sql } = require('../config/db');
const { logError } = require('../utils/errorLogger');

const BACKUP_DIR      = process.env.DB_BACKUP_DIR || 'C:\\WebApp\\db_backups';
const RETENTION_DAYS  = Number(process.env.DB_BACKUP_RETENTION_DAYS || 14);
const DB_NAME         = process.env.DB_NAME || 'QuanLyTinBai';

function timestamp() {
    return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
}

async function cleanupOldBackups() {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith(`${DB_NAME}_daily_`) && f.endsWith('.bak'));
    for (const f of files) {
        const fullPath = path.join(BACKUP_DIR, f);
        if (fs.statSync(fullPath).mtimeMs < cutoff) {
            fs.unlinkSync(fullPath);
            console.log('🗑️  Đã xoá backup cũ:', f);
        }
    }
}

(async () => {
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const backupPath = path.join(BACKUP_DIR, `${DB_NAME}_daily_${timestamp()}.bak`);

        const pool = await poolPromise;
        console.log('Đang backup database vào', backupPath);
        await pool.request()
            .input('path', sql.NVarChar, backupPath)
            .query(`BACKUP DATABASE ${DB_NAME} TO DISK = @path WITH INIT, NAME = N'${DB_NAME} daily backup'`);
        console.log('✅ Backup xong.');

        await cleanupOldBackups();
        console.log(`✅ Dọn xong, chỉ giữ ${RETENTION_DAYS} ngày gần nhất.`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Backup thất bại:', err.message);
        await logError({ source: 'scripts.daily-backup', message: err.message, stack: err.stack });
        process.exit(1);
    }
})();
