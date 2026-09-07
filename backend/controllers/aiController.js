const aiGateway = require('../services/aiGatewayClient');
const { normalizeConversation } = require('../utils/aiConversation');
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
    // Sai khoá là lỗi cấu hình của chính mình, KHÁC với "gateway chưa chạy": phải ghi log
    // để còn biết mà sửa .env, nhưng không đổ lỗi kỹ thuật ra cho người dùng cuối.
    if (err instanceof aiGateway.AiGatewayAuthError) {
        logError({ source, message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        return res.status(503).json({ error: 'Trợ lý AI đang bị lỗi cấu hình, vui lòng báo quản trị viên.', connected: false });
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

// --- Module 5: Trợ lý hỏi đáp tự do ---

// Khác 4 module trên (mỗi module bó vào đúng 1 tác vụ biên tập), đây là hội thoại mở:
// hỏi gì cũng được. Vẫn giữ system prompt để chốt vai trò và cấm bịa — luật "luôn trả
// lời tiếng Việt" do aiGatewayClient tự gắn nên không cần lặp lại ở đây.
const ASSISTANT_SYSTEM_PROMPT = [
    'Bạn là trợ lý AI trong hệ thống Quản lý Tin bài của một cơ quan báo chí tại Đắk Lắk.',
    'Người dùng là phóng viên, biên tập viên và cộng tác viên. Họ có thể hỏi bạn BẤT KỲ chủ đề nào,',
    'không giới hạn trong nghiệp vụ báo chí.',
    'Trả lời ngắn gọn, đi thẳng vào trọng tâm; chỉ chia ý theo gạch đầu dòng khi câu trả lời thực sự dài.',
    'Nếu không biết hoặc không chắc chắn thì nói thẳng là không biết — tuyệt đối không bịa số liệu,',
    'ngày tháng, tên người hay nội dung văn bản pháp luật.'
].join(' ');

// Câu trả lời tự do thường dài hơn nhiều so với sapo/tiêu đề, mà Ollama máy A chỉ sinh
// khoảng 11 token/giây nên 60s mặc định dễ bị cắt ngang giữa chừng.
const ASSISTANT_TIMEOUT_MS = 120000;

exports.chat = async (req, res) => {
    const { messages } = req.body;
    const normalized = normalizeConversation(messages);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    try {
        const reply = await aiGateway.chat(
            [{ role: 'system', content: ASSISTANT_SYSTEM_PROMPT }, ...normalized.messages],
            { timeoutMs: ASSISTANT_TIMEOUT_MS }
        );
        const trimmed = reply.trim();
        if (!trimmed) return res.status(502).json({ error: 'Trợ lý không trả về nội dung nào, thử hỏi lại.' });
        res.json({ reply: trimmed });
    } catch (err) {
        handleAiError(err, req, res, 'aiController.chat');
    }
};

exports.transcribe = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không có file audio' });

    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const aiGatewayUrl = (process.env.AI_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const apiKey = process.env.AI_GATEWAY_API_KEY || '';

    try {
        const response = await fetch(`${aiGatewayUrl}/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) throw new Error(`Gateway transcribe lỗi ${response.status}`);
        const data = await response.json();
        res.json({ text: data.text || '' });
    } catch (err) {
        console.error('[aiController] transcribe error:', err);
        if (err instanceof aiGateway.AiGatewayUnavailableError || err.message.includes('timeout')) {
            return res.status(503).json({ error: 'Lỗi rã băng: không kết nối AI Gateway' });
        }
        res.status(500).json({ error: 'Lỗi rã băng: ' + err.message });
    }
};
