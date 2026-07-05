const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const now = new Date();
        const dateFolder = `${now.getUTCFullYear()}\\${String(now.getUTCMonth() + 1).padStart(2, '0')}\\${String(now.getUTCDate()).padStart(2, '0')}`;
        const fullFolder = path.join(STORAGE_ROOT, 'ChatStorage', dateFolder);
        fs.mkdirSync(fullFolder, { recursive: true });
        cb(null, fullFolder);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}_${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
        const random = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}_${random}${ext}`);
    }
});

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_EXTS = [...IMAGE_EXTS, '.pdf'];

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_EXTS.includes(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận ảnh (.jpg, .jpeg, .png, .gif, .webp) hoặc .pdf'));
        }
    }
});

function isImageFile(originalName) {
    return IMAGE_EXTS.includes(path.extname(originalName).toLowerCase());
}

module.exports = { upload, isImageFile, STORAGE_ROOT };
