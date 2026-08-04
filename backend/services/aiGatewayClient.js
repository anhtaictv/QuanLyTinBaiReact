// Client mỏng gọi AI Gateway dùng chung cho 3 app trên VPS (xem AI_GATEWAY.md ở gốc
// repo). Gateway đứng giữa, tự lo thử Ollama máy A qua Tailscale trước rồi fallback
// Claude/OpenAI khi cần — ở đây chỉ cần nói đúng chuẩn OpenAI chat/embeddings, không
// cần biết/chọn model hay provider thật đứng sau.
const BASE_URL = (process.env.AI_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const API_KEY  = process.env.AI_GATEWAY_API_KEY || '';

// Model chat sau gateway đang là qwen2.5 (model Trung Quốc). Khi prompt không nói rõ
// ngôn ngữ, nó trả lời lẫn tiếng Trung — đo thực tế 2/5 câu bị lẫn, riêng câu hỏi bằng
// tiếng Trung thì trả lời 100% tiếng Trung. Ép luật này vào mọi lượt chat đưa tỉ lệ về
// 0/5, rẻ và chắc hơn đổi sang model tiếng Việt (các model Việt sẵn có đều cũ hơn và
// context ngắn hơn nhiều, không kham nổi việc sửa cả bài dài và tra cứu RAG).
const VIETNAMESE_RULE = 'Luôn trả lời hoàn toàn bằng tiếng Việt, kể cả khi câu hỏi được viết bằng ngôn ngữ khác. Tuyệt đối không chèn tiếng Trung hay ngôn ngữ khác, trừ tên riêng và thuật ngữ không có từ tiếng Việt tương đương.';

// Health probe cần rộng hơn 2s: gateway chỉ trả lời sau khi đã ping được Ollama máy A
// qua Tailscale, đo thực tế 2.2-4.3s. Để 2s thì isAvailable() gần như luôn báo "tắt"
// dù chat/embeddings vẫn chạy tốt.
const HEALTH_TIMEOUT_MS = 8000;

// Tiếng Việt viết bằng chữ Latin có dấu nên bất kỳ ký tự Hán/Kana/Hangul nào trong câu
// trả lời đều chắc chắn là rò rỉ ngôn ngữ, không thể là dương tính giả.
const CJK_PATTERN = /[一-鿿぀-ヿ가-힯]/;

// Chỉ dùng cho lượt gọi lại khi lượt đầu đã lẫn tiếng nước ngoài — nói thẳng và gay gắt
// hơn VIETNAMESE_RULE. Không dùng ngay từ lượt đầu vì prompt dài làm loãng các yêu cầu
// nghiệp vụ của 4 module kia (vd "chỉ trả về mảng JSON").
const STRICT_VIETNAMESE_RULE = 'CỰC KỲ QUAN TRỌNG: Toàn bộ câu trả lời PHẢI viết bằng tiếng Việt. Cấm tuyệt đối dùng chữ Hán, chữ Trung Quốc, tiếng Nhật hoặc tiếng Hàn dưới mọi hình thức. Nếu định viết một từ bằng tiếng Trung, hãy dịch từ đó sang tiếng Việt rồi mới viết.';

class AiGatewayUnavailableError extends Error {
    constructor(cause) {
        super('Không kết nối được AI Gateway. Kiểm tra AI_GATEWAY_URL/AI_GATEWAY_API_KEY trong .env và đảm bảo gateway đang chạy.');
        this.name = 'AiGatewayUnavailableError';
        this.cause = cause;
    }
}

// Tách riêng khỏi lỗi "chưa sẵn sàng": gateway vẫn sống và trả lời được, chỉ là ta cầm
// sai khoá. Trước đây 401 rơi vào nhánh throw chung nên hiện ra thành lỗi 500 khó hiểu,
// trong khi /health lại không đòi auth nên vẫn báo "connected" — rất khó lần ra.
class AiGatewayAuthError extends Error {
    constructor(status, body) {
        super(`AI Gateway từ chối khoá (HTTP ${status}). AI_GATEWAY_API_KEY trong .env phải khớp GATEWAY_API_KEY của gateway.`);
        this.name = 'AiGatewayAuthError';
        this.status = status;
        this.body = body;
    }
}

function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` };
}

// Gắn luật tiếng Việt vào message hệ thống (tạo mảng mới, không sửa mảng gọi vào).
// Module nào đã có system prompt riêng thì nối luật vào cuối để giữ nguyên yêu cầu định
// dạng của nó (vd "chỉ trả về mảng JSON") — tách luật thành system prompt thứ hai sẽ
// khiến model coi nhẹ một trong hai.
function withVietnamese(messages) {
    const list = Array.isArray(messages) ? messages : [];
    const systemIndex = list.findIndex(m => m && m.role === 'system');

    if (systemIndex === -1) return [{ role: 'system', content: VIETNAMESE_RULE }, ...list];
    if (String(list[systemIndex].content || '').includes(VIETNAMESE_RULE)) return list;

    return list.map((m, i) => (
        i === systemIndex ? { ...m, content: `${m.content}\n\n${VIETNAMESE_RULE}` } : m
    ));
}

// Ném đúng loại lỗi theo mã trạng thái, dùng chung cho chat và embeddings.
async function assertOk(res, label) {
    if (res.ok) return;
    const body = await res.text().catch(() => '');
    // Gateway trả 503 khi cả Ollama máy A và fallback đều không gọi được — coi như
    // "chưa sẵn sàng" (giống lúc Ollama tắt trước đây), không phải lỗi 500 bất ngờ.
    if (res.status === 503) throw new AiGatewayUnavailableError(new Error(body));
    if (res.status === 401 || res.status === 403) throw new AiGatewayAuthError(res.status, body);
    throw new Error(`AI Gateway ${label} trả lỗi ${res.status}: ${body}`);
}

async function isAvailable() {
    try {
        const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        return !!(data && (data.ollama || data.fallbackProvider !== 'none'));
    } catch {
        return false;
    }
}

async function postChat(messages, timeoutMs, extraBody = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ messages, ...extraBody }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        throw new AiGatewayUnavailableError(err);
    }
    await assertOk(res, 'chat');
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

// messages: [{role: 'system'|'user'|'assistant', content: string}]
async function chat(messages, { timeoutMs = 60000 } = {}) {
    const prepared = withVietnamese(messages);
    const reply = await postChat(prepared, timeoutMs);
    if (!CJK_PATTERN.test(reply)) return reply;

    // System prompt một mình không đủ chắc với model 7B: đo thực tế vẫn có câu bị trả
    // lời bằng tiếng Trung. Hỏi lại TỪ ĐẦU thay vì yêu cầu "viết lại" — thử cách viết
    // lại thì đoạn chữ Trung hỏng nằm trong ngữ cảnh kéo model tiếp tục viết tiếng
    // Trung, hỏng cả lượt sửa. Lần này kẹp luật gắt ở cả đầu lẫn cuối system prompt và
    // hạ temperature cho model bớt bay. Chỉ tốn thêm một lượt gọi trong trường hợp hiếm.
    const strict = prepared.map(m => (
        m.role === 'system'
            ? { ...m, content: `${STRICT_VIETNAMESE_RULE}\n\n${m.content}\n\n${STRICT_VIETNAMESE_RULE}` }
            : m
    ));
    const retried = await postChat(strict, timeoutMs, { temperature: 0.2 });

    // Thử lại vẫn lẫn thì giữ bản gốc: ít ra nó bám sát câu hỏi ban đầu hơn.
    return CJK_PATTERN.test(retried) ? reply : retried;
}

async function embed(text, { timeoutMs = 30000 } = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/v1/embeddings`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ input: text }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        throw new AiGatewayUnavailableError(err);
    }
    await assertOk(res, 'embeddings');
    const data = await res.json();
    return data.data?.[0]?.embedding || [];
}

module.exports = {
    chat, embed, isAvailable, withVietnamese,
    AiGatewayUnavailableError, AiGatewayAuthError,
    VIETNAMESE_RULE, BASE_URL
};
