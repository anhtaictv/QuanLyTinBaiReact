// Client mỏng gọi AI Gateway dùng chung cho 3 app trên VPS (xem AI_GATEWAY.md ở gốc
// repo). Gateway đứng giữa, tự lo thử Ollama máy A qua Tailscale trước rồi fallback
// Claude/OpenAI khi cần — ở đây chỉ cần nói đúng chuẩn OpenAI chat/embeddings, không
// cần biết/chọn model hay provider thật đứng sau.
const BASE_URL = (process.env.AI_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const API_KEY  = process.env.AI_GATEWAY_API_KEY || '';

class AiGatewayUnavailableError extends Error {
    constructor(cause) {
        super('Không kết nối được AI Gateway. Kiểm tra AI_GATEWAY_URL/AI_GATEWAY_API_KEY trong .env và đảm bảo gateway đang chạy.');
        this.name = 'AiGatewayUnavailableError';
        this.cause = cause;
    }
}

function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` };
}

async function isAvailable() {
    try {
        const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        return !!(data && (data.ollama || data.fallbackProvider !== 'none'));
    } catch {
        return false;
    }
}

// messages: [{role: 'system'|'user'|'assistant', content: string}]
async function chat(messages, { timeoutMs = 60000 } = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ messages }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        throw new AiGatewayUnavailableError(err);
    }
    // Gateway trả 503 khi cả Ollama máy A và fallback đều không gọi được — coi như
    // "chưa sẵn sàng" (giống lúc Ollama tắt trước đây), không phải lỗi 500 bất ngờ.
    if (res.status === 503) throw new AiGatewayUnavailableError(new Error(await res.text().catch(() => '')));
    if (!res.ok) throw new Error(`AI Gateway chat trả lỗi ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
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
    if (res.status === 503) throw new AiGatewayUnavailableError(new Error(await res.text().catch(() => '')));
    if (!res.ok) throw new Error(`AI Gateway embeddings trả lỗi ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return data.data?.[0]?.embedding || [];
}

module.exports = { chat, embed, isAvailable, AiGatewayUnavailableError, BASE_URL };
