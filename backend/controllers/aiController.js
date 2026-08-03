const aiGateway = require('../services/aiGatewayClient');
const { logError } = require('../utils/errorLogger');

// Danh mục hiện có trên form soạn bài (NewsForm.jsx) — giữ khớp để gợi ý category
// luôn map được vào dropdown có sẵn, không cần thêm danh mục mới.
const CATEGORIES = ['Chưa phân loại', 'ANTT', 'AN247', 'Kinh tế', 'Xã hội'];

// AI Gateway có thể chưa deploy/chưa chạy — đây là trạng thái BÌNH THƯỜNG cho tới khi
// gateway lên VPS thật, nên không log vào ErrorLogs/Telegram (sẽ gây nhiễu báo lỗi).
// Chỉ log các lỗi thật sự bất ngờ khác.
function handleAiError(err, req, res, source) {
    if (err instanceof aiGateway.AiGatewayUnavailableError) {
        return res.status(503).json({ error: err.message, connected: false });
    }
    logError({ source, message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
}

// Cố gắng trích + parse JSON từ câu trả lời của model kể cả khi model kèm thêm chữ
// thừa (giải thích, markdown ```json``` ...) quanh khối JSON.
function extractJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { /* thử fallback bên dưới */ }
    const match = raw.match(/[[{][\s\S]*[\]}]/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
}

exports.health = async (req, res) => {
    const connected = await aiGateway.isAvailable();
    res.json({ connected });
};

exports.proofread = async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Thiếu nội dung cần sửa.' });
    try {
        const result = await aiGateway.chat([
            { role: 'system', content: 'Bạn là biên tập viên báo chí tiếng Việt. Sửa lỗi chính tả, ngữ pháp, câu từ lủng củng và chuẩn hóa văn phong sang chuẩn báo chí/tuyên truyền công vụ. Chỉ trả về đúng đoạn văn đã sửa, không giải thích, không thêm ghi chú.' },
            { role: 'user', content: text }
        ]);
        res.json({ result: result.trim() });
    } catch (err) {
        handleAiError(err, req, res, 'aiController.proofread');
    }
};

exports.suggestHeadlines = async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung bài viết.' });
    try {
        const raw = await aiGateway.chat([
            { role: 'system', content: 'Bạn là biên tập viên báo chí tiếng Việt. Dựa vào nội dung bài viết, đưa ra 5 gợi ý tiêu đề (đa dạng: chuẩn chính luận, chuẩn SEO, giật gân hợp lý). Trả về DUY NHẤT một mảng JSON các chuỗi, ví dụ: ["Tiêu đề 1","Tiêu đề 2"]. Không thêm chữ nào khác.' },
            { role: 'user', content }
        ]);
        const headlines = extractJson(raw);
        if (!Array.isArray(headlines)) return res.status(502).json({ error: 'Model trả kết quả không đúng định dạng, thử lại.' });
        res.json({ headlines: headlines.filter(h => typeof h === 'string').slice(0, 5) });
    } catch (err) {
        handleAiError(err, req, res, 'aiController.suggestHeadlines');
    }
};

exports.summarize = async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung bài viết.' });
    try {
        const result = await aiGateway.chat([
            { role: 'system', content: 'Bạn là biên tập viên báo chí tiếng Việt. Tóm tắt nội dung sau thành đoạn Sapo 2-3 câu, súc tích, đủ ý chính. Chỉ trả về đoạn Sapo, không giải thích.' },
            { role: 'user', content }
        ]);
        res.json({ sapo: result.trim() });
    } catch (err) {
        handleAiError(err, req, res, 'aiController.summarize');
    }
};

exports.categorize = async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung bài viết.' });
    try {
        const raw = await aiGateway.chat([
            {
                role: 'system',
                content: `Bạn là biên tập viên báo chí tiếng Việt tại Đắk Lắk. Đọc nội dung và trả về DUY NHẤT một object JSON dạng:
{"category":"<một trong ${JSON.stringify(CATEGORIES)}>","tags":["thực thể 1","thực thể 2"]}
"tags" là các thực thể quan trọng nhận diện được: tên người, địa danh (phường/xã/huyện thuộc Đắk Lắk), cơ quan/tổ chức. Không thêm chữ nào khác ngoài object JSON.`
            },
            { role: 'user', content }
        ]);
        const parsed = extractJson(raw);
        if (!parsed || typeof parsed !== 'object') return res.status(502).json({ error: 'Model trả kết quả không đúng định dạng, thử lại.' });
        res.json({
            category: CATEGORIES.includes(parsed.category) ? parsed.category : CATEGORIES[0],
            tags: Array.isArray(parsed.tags) ? parsed.tags.filter(t => typeof t === 'string').slice(0, 20) : []
        });
    } catch (err) {
        handleAiError(err, req, res, 'aiController.categorize');
    }
};

// --- Module 3: kiểm duyệt & bảo mật thông tin ---

// Regex trước — chạy được kể cả AI Gateway tắt, đáng tin cậy hơn LLM cho dữ liệu có cấu trúc.
const PII_PATTERNS = [
    { label: 'Số CMND/CCCD', re: /\b\d{9}(\d{3})?\b/g },
    { label: 'Số điện thoại', re: /\b(0|\+84)(\d{9,10})\b/g },
    { label: 'Biển số xe', re: /\b\d{2}[A-Z]-?\d{3}\.?\d{2,3}\b/g },
];

function scanPii(text) {
    const matches = [];
    for (const { label, re } of PII_PATTERNS) {
        const found = text.match(re);
        if (found) matches.push({ label, values: [...new Set(found)] });
    }
    return matches;
}

exports.scanSensitive = async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Thiếu nội dung cần kiểm tra.' });

    const piiMatches = scanPii(text);
    let wordingWarnings = [];
    try {
        const raw = await aiGateway.chat([
            { role: 'system', content: 'Bạn kiểm duyệt biên tập báo chí Việt Nam. Rà soát đoạn văn sau, liệt kê các từ/cụm từ có thể vi phạm quy định biên tập hoặc chưa đúng chuẩn mực ngôn luận (ví dụ: suy đoán chưa kiểm chứng, ngôn từ kích động, tiết lộ đời tư không cần thiết). Trả về DUY NHẤT một mảng JSON các chuỗi ngắn mô tả từng vấn đề (mảng rỗng [] nếu không có vấn đề gì). Không thêm chữ nào khác.' },
            { role: 'user', content: text }
        ]);
        const parsed = extractJson(raw);
        if (Array.isArray(parsed)) wordingWarnings = parsed.filter(w => typeof w === 'string').slice(0, 20);
    } catch (err) {
        // AI Gateway chưa sẵn sàng: vẫn trả kết quả regex, chỉ bỏ qua phần LLM.
        if (!(err instanceof aiGateway.AiGatewayUnavailableError)) {
            logError({ source: 'aiController.scanSensitive(llm)', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        }
    }

    res.json({ piiMatches, wordingWarnings });
};
