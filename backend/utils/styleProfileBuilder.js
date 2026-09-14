// Hồ sơ văn phong cá nhân: AI đọc các bài ĐÃ DUYỆT gần nhất của một người, tóm tắt cách
// hành văn (từ ngữ quen dùng, độ dài câu, giọng điệu, tách riêng theo thể loại nếu nhận
// ra) thành 1 đoạn text ngắn, lưu vào dbo.UserStyleProfiles. Dùng chung bởi
// scripts/update-style-profiles.js (chạy định kỳ qua Windows Task Scheduler, cùng lý do
// với utils/newsDigestFetcher.js) và controllers/aiController.js (nút "Cập nhật ngay").
const { poolPromise } = require('../config/db');
const aiGatewayClient = require('../services/aiGatewayClient');

// Ít hơn thì tín hiệu văn phong quá mỏng, hồ sơ tạo ra sẽ là AI tự bịa cho có chứ không
// phản ánh thật thói quen viết của người đó.
const MIN_SOURCE_POSTS = 3;
// Trần số bài đưa vào 1 lượt gọi AI Gateway — model chạy trên máy A qua Tailscale, context
// và tốc độ đều có hạn (xem AI_GATEWAY.md), không cần thêm bài cũ hơn nữa để thấy rõ văn phong.
const MAX_SOURCE_POSTS = 12;
// Mỗi bài cắt còn tối đa chừng này ký tự trước khi gộp — phần đầu bài đã đủ bộc lộ giọng
// văn, không cần nguyên văn bài dài để phân tích phong cách.
const MAX_CHARS_PER_POST = 800;
// Nội dung dài hơn hẳn 1 lượt sinh sapo/tiêu đề bình thường (gộp tới 12 bài) nên timeout
// phải rộng hơn mặc định 60s của aiGatewayClient.chat().
const PROFILE_TIMEOUT_MS = 120000;
// Hồ sơ sửa tay được nối vào system prompt của proofread/headlines/sapo/chat mỗi lượt
// gọi AI — chặn trần để 1 người dán cả nghìn chữ vào không làm phình mọi request AI khác.
const MAX_MANUAL_PROFILE_CHARS = 3000;

const STYLE_PROFILE_SYSTEM_PROMPT = [
    'Bạn là biên tập viên phân tích văn phong báo chí tiếng Việt.',
    'Dưới đây là các đoạn trích từ nhiều bài viết ĐÃ ĐƯỢC DUYỆT của CÙNG MỘT tác giả.',
    'Nhiệm vụ: tóm tắt phong cách viết đặc trưng của tác giả này thành một bản hướng dẫn ngắn gọn,',
    'để AI khác dùng làm tham khảo khi viết/sửa bài giúp chính tác giả này — không phải để chấm điểm hay phê bình.',
    'Nêu cụ thể: từ/cụm từ quen dùng, độ dài và cấu trúc câu, giọng điệu (trang trọng/gần gũi/khô khan...),',
    'thói quen mở đầu và kết bài. Nếu nhận ra các bài thuộc nhiều thể loại khác nhau',
    '(ví dụ: tin ngắn, phóng sự, ghi nhanh, bài phản ánh...), tách riêng một đoạn nhận xét ngắn cho từng thể loại nhận diện được.',
    'Viết dạng gạch đầu dòng, súc tích. KHÔNG trích nguyên câu từ bài gốc, KHÔNG bịa đặc điểm không thấy trong mẫu.',
    'Nếu mẫu quá ít hoặc không đủ để nhận ra đặc điểm rõ ràng, nói thẳng là chưa đủ dữ liệu thay vì đoán bừa.'
].join(' ');

// Cùng cách parse Content JSON như newsController.js (exportStoryboard/approveNews):
// cột lưu {kieu, ten, hinhAnh, sapo, noiDung}, bài rất cũ trước khi có format này thì
// Content là text thô — try/catch rồi rơi về coi cả cột là noiDung.
function extractPostText(post) {
    let data;
    try { data = JSON.parse(post.Content); } catch { data = { noiDung: post.Content }; }
    return [data.sapo, data.noiDung].filter(Boolean).join('\n').trim();
}

async function fetchAuthorSamples(pool, userId) {
    const result = await pool.request()
        .input('UserID', userId)
        .query(`
            SELECT TOP ${MAX_SOURCE_POSTS} PostID, Title, Content, CreatedAt
            FROM dbo.Posts
            WHERE AuthorID = @UserID AND StatusID = 2
            ORDER BY CreatedAt DESC
        `);
    return result.recordset || [];
}

function buildSampleText(posts) {
    return posts.map((post, i) => {
        const text = extractPostText(post).slice(0, MAX_CHARS_PER_POST);
        return `--- Bài ${i + 1}: "${post.Title || '(không tiêu đề)'}" ---\n${text}`;
    }).join('\n\n');
}

// isLocked mặc định 0: đây là đường ghi của AI tự sinh (auto-refresh hoặc "Cập nhật ngay"
// đều đi qua đây), luôn mở khoá lại — người bấm "Cập nhật ngay" là đang chủ động nhờ AI
// viết lại, nên coi như đồng ý bỏ qua bản sửa tay cũ.
async function saveStyleProfile(pool, userId, profileText, sourcePostCount) {
    await pool.request()
        .input('UserID', userId)
        .input('ProfileText', profileText)
        .input('SourcePostCount', sourcePostCount)
        .query(`
            IF EXISTS (SELECT 1 FROM dbo.UserStyleProfiles WHERE UserID = @UserID)
                UPDATE dbo.UserStyleProfiles
                SET ProfileText = @ProfileText, SourcePostCount = @SourcePostCount, IsLocked = 0, UpdatedAt = GETUTCDATE()
                WHERE UserID = @UserID
            ELSE
                INSERT INTO dbo.UserStyleProfiles (UserID, ProfileText, SourcePostCount, IsLocked, UpdatedAt)
                VALUES (@UserID, @ProfileText, @SourcePostCount, 0, GETUTCDATE())
        `);
}

// Ghi tay của người dùng — LUÔN khoá (IsLocked = 1) để đợt auto-refresh định kỳ tiếp theo
// (scripts/update-style-profiles.js) không âm thầm ghi đè mất bản họ vừa tự sửa.
// SourcePostCount giữ nguyên giá trị cũ: đây không phải số bài AI vừa đọc, chỉ là mốc để
// hiển thị "dựa trên N bài" — sửa tay thì con số đó không còn ý nghĩa để tính lại.
async function saveManualStyleProfile(userId, profileText) {
    const pool = await poolPromise;
    const trimmed = profileText.trim().slice(0, MAX_MANUAL_PROFILE_CHARS);
    const existing = await getStyleProfile(userId);
    const sourcePostCount = existing?.SourcePostCount || 0;

    await pool.request()
        .input('UserID', userId)
        .input('ProfileText', trimmed)
        .input('SourcePostCount', sourcePostCount)
        .query(`
            IF EXISTS (SELECT 1 FROM dbo.UserStyleProfiles WHERE UserID = @UserID)
                UPDATE dbo.UserStyleProfiles
                SET ProfileText = @ProfileText, IsLocked = 1, UpdatedAt = GETUTCDATE()
                WHERE UserID = @UserID
            ELSE
                INSERT INTO dbo.UserStyleProfiles (UserID, ProfileText, SourcePostCount, IsLocked, UpdatedAt)
                VALUES (@UserID, @ProfileText, @SourcePostCount, 1, GETUTCDATE())
        `);
    return trimmed;
}

async function getStyleProfile(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserID', userId)
        .query('SELECT ProfileText, SourcePostCount, IsLocked, UpdatedAt FROM dbo.UserStyleProfiles WHERE UserID = @UserID');
    return result.recordset?.[0] || null;
}

// Trả về null khi bỏ qua (KHÔNG ghi đè hồ sơ cũ bằng kết quả rác) — vì chưa đủ dữ liệu,
// hoặc (khi ignoreLock=false, tức đợt auto-refresh định kỳ) vì người dùng đã tự sửa và
// khoá. ignoreLock=true dành cho nút "Cập nhật ngay" — bấm nút là chủ động ghi đè.
async function refreshStyleProfile(userId, { ignoreLock = false } = {}) {
    const pool = await poolPromise;

    if (!ignoreLock) {
        const existing = await getStyleProfile(userId);
        if (existing?.IsLocked) return null;
    }

    const posts = await fetchAuthorSamples(pool, userId);
    if (posts.length < MIN_SOURCE_POSTS) return null;

    const profileText = (await aiGatewayClient.chat([
        { role: 'system', content: STYLE_PROFILE_SYSTEM_PROMPT },
        { role: 'user', content: buildSampleText(posts) }
    ], { temperature: 0.3, timeoutMs: PROFILE_TIMEOUT_MS })).trim();
    if (!profileText) return null;

    await saveStyleProfile(pool, userId, profileText, posts.length);
    return { profileText, sourcePostCount: posts.length };
}

// Chạy tuần tự từng người (không Promise.all) — cùng lý do với fetchAllSources() của
// newsDigestFetcher.js: gateway giới hạn số request đồng thời, và 1 người lỗi (vd nội
// dung quá dài, gateway timeout) không được chặn cập nhật của những người còn lại.
async function refreshAllStyleProfiles() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT AuthorID
        FROM dbo.Posts
        WHERE StatusID = 2 AND AuthorID IS NOT NULL
        GROUP BY AuthorID
        HAVING COUNT(*) >= ${MIN_SOURCE_POSTS}
    `);
    const authorIds = (result.recordset || []).map(r => r.AuthorID);

    let updated = 0;
    const errors = [];
    for (const userId of authorIds) {
        try {
            if (await refreshStyleProfile(userId)) updated++;
        } catch (err) {
            errors.push({ userId, message: err.message });
        }
    }
    return { total: authorIds.length, updated, errors };
}

module.exports = {
    getStyleProfile, refreshStyleProfile, refreshAllStyleProfiles, saveManualStyleProfile,
    MIN_SOURCE_POSTS, MAX_MANUAL_PROFILE_CHARS
};
