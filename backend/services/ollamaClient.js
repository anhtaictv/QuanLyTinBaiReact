// Wrapper mỏng gọi thẳng REST API của Ollama (không dùng SDK riêng — Node 18+ đã có
// fetch sẵn). OLLAMA_BASE_URL trỏ localhost khi chưa có máy chạy Ollama; sau này chỉ
// cần đổi sang IP Tailscale của máy chạy Ollama trong .env, không cần sửa code.
const BASE_URL    = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const CHAT_MODEL  = process.env.OLLAMA_CHAT_MODEL  || 'qwen2.5';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

class OllamaUnavailableError extends Error {
    constructor(cause) {
        super('Không kết nối được AI local (Ollama). Kiểm tra OLLAMA_BASE_URL trong .env và đảm bảo Ollama đang chạy.');
        this.name = 'OllamaUnavailableError';
        this.cause = cause;
    }
}

async function isAvailable() {
    try {
        const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

// messages: [{role: 'system'|'user'|'assistant', content: string}]
async function chat(messages, { timeoutMs = 60000 } = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: CHAT_MODEL, messages, stream: false }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        throw new OllamaUnavailableError(err);
    }
    if (!res.ok) {
        throw new Error(`Ollama chat trả lỗi ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = await res.json();
    return data.message?.content || '';
}

async function embed(text, { timeoutMs = 30000 } = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        throw new OllamaUnavailableError(err);
    }
    if (!res.ok) {
        throw new Error(`Ollama embeddings trả lỗi ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = await res.json();
    return data.embedding || [];
}

module.exports = { chat, embed, isAvailable, OllamaUnavailableError, CHAT_MODEL, EMBED_MODEL, BASE_URL };
