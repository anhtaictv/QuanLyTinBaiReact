// Chuẩn hóa + kiểm tra hội thoại gửi lên cho trợ lý AI hỏi tự do.
// Tách khỏi controller để test được bằng `node --test` mà không cần dựng server.

// Giữ đủ ngữ cảnh cho hội thoại nhiều lượt nhưng không để prompt phình vô hạn: mỗi lượt
// đều được gửi lại nguyên văn lên gateway nên hội thoại càng dài, mỗi câu trả lời càng
// chậm và càng tốn token của fallback Claude khi Ollama chết.
const MAX_TURNS = 30;
const MAX_CONTENT_CHARS = 6000;
const MAX_TOTAL_CHARS = 24000;

// Chỉ nhận 'user' và 'assistant'. Vai 'system' cố tình KHÔNG cho client gửi: system
// prompt là nơi đặt luật tiếng Việt và giới hạn phạm vi trợ lý, để client tự đặt thì
// người dùng có thể ghi đè toàn bộ (prompt injection).
const ALLOWED_ROLES = ['user', 'assistant'];

function normalizeConversation(input) {
    if (!Array.isArray(input) || input.length === 0) {
        return { error: 'Thiếu nội dung hội thoại.' };
    }

    const cleaned = [];
    for (const item of input) {
        if (!item || typeof item !== 'object') {
            return { error: 'Định dạng tin nhắn không hợp lệ.' };
        }
        if (!ALLOWED_ROLES.includes(item.role)) {
            return { error: `Vai trò tin nhắn không hợp lệ: ${item.role}` };
        }
        if (typeof item.content !== 'string') {
            return { error: 'Nội dung tin nhắn phải là chuỗi.' };
        }

        const content = item.content.trim();
        if (!content) return { error: 'Tin nhắn không được để trống.' };
        if (content.length > MAX_CONTENT_CHARS) {
            return { error: `Tin nhắn quá dài (tối đa ${MAX_CONTENT_CHARS} ký tự).` };
        }

        cleaned.push({ role: item.role, content });
    }

    // Cắt bớt các lượt cũ nhất — người dùng quan tâm phần cuối hội thoại.
    const trimmed = cleaned.slice(-MAX_TURNS);

    if (trimmed[trimmed.length - 1].role !== 'user') {
        return { error: 'Tin nhắn cuối cùng phải là câu hỏi của người dùng.' };
    }

    const totalChars = trimmed.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
        return { error: `Hội thoại quá dài (tối đa ${MAX_TOTAL_CHARS} ký tự), hãy bắt đầu cuộc trò chuyện mới.` };
    }

    return { messages: trimmed };
}

module.exports = { normalizeConversation, MAX_TURNS, MAX_CONTENT_CHARS, MAX_TOTAL_CHARS };
