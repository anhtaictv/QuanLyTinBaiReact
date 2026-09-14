// Cố gắng trích + parse JSON từ câu trả lời của model kể cả khi model kèm thêm chữ
// thừa (giải thích, markdown ```json``` ...) quanh khối JSON.
function extractJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { /* thử fallback bên dưới */ }
    const match = raw.match(/[[{][\s\S]*[\]}]/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
}

module.exports = { extractJson };
