const aiGateway = require('../services/aiGatewayClient');
const ragStore = require('../services/ragStore');
const { extractJson } = require('../utils/aiJson');
const { logError } = require('../utils/errorLogger');

function handleRagError(err, req, res, source) {
    if (err instanceof aiGateway.AiGatewayUnavailableError) {
        return res.status(503).json({ error: err.message, connected: false });
    }
    logError({ source, message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
}

exports.ingest = async (req, res) => {
    const { title, content, type } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu tiêu đề văn bản.' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung văn bản.' });
    try {
        const result = await ragStore.addDocument(title.trim(), content, { type: type || 'style-guide' });
        res.json({ success: true, ...result });
    } catch (err) {
        handleRagError(err, req, res, 'ragController.ingest');
    }
};

exports.listDocs = (req, res) => {
    res.json({ documents: ragStore.listDocuments() });
};

exports.deleteDoc = (req, res) => {
    const removed = ragStore.deleteDocument(req.params.sourceId);
    res.json({ success: true, removedChunks: removed });
};

exports.ask = async (req, res) => {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi.' });
    try {
        const queryEmbedding = await aiGateway.embed(question);
        const topChunks = ragStore.search(queryEmbedding, 4).filter(c => c.score > 0.3);

        if (topChunks.length === 0) {
            return res.json({ answer: 'Chưa tìm thấy văn bản quy định nào liên quan trong kho tri thức đã nạp.', sources: [] });
        }

        const context = topChunks
            .map((c, i) => `[Đoạn ${i + 1} - từ "${c.title}"]\n${c.chunk}`)
            .join('\n\n');

        const answer = await aiGateway.chat([
            {
                role: 'system',
                content: 'Bạn là trợ lý tra cứu quy định biên tập/báo chí. CHỈ trả lời dựa trên các đoạn văn bản được cung cấp dưới đây. Nếu văn bản không đủ thông tin để trả lời, nói rõ là không tìm thấy quy định liên quan — không tự suy diễn hay bịa thêm.'
            },
            { role: 'user', content: `Văn bản tham khảo:\n\n${context}\n\nCâu hỏi: ${question}` }
        ]);

        res.json({
            answer: answer.trim(),
            sources: topChunks.map(c => ({ title: c.title, chunk: c.chunk, score: c.score }))
        });
    } catch (err) {
        handleRagError(err, req, res, 'ragController.ask');
    }
};

// Chạy chung cho fact-check (đối chiếu bài đã duyệt) và consistency (đối chiếu cẩm nang
// tòa soạn) — chỉ khác corpus (type) và prompt. Không hard-fail khi thiếu ngữ cảnh tham
// khảo (khác exports.ask): dù chưa nạp corpus, người dùng vẫn cần thấy AI đã chạy, chỉ là
// không có gì để đối chiếu — hard-fail vô ích hơn ở đây vì đây là bước kiểm tra chủ động,
// không phải hỏi-đáp cần nguồn mới có nghĩa.
async function runRagCheck({ content, type, systemPrompt, itemsKey }) {
    const queryEmbedding = await aiGateway.embed(content);
    const topChunks = ragStore.search(queryEmbedding, 4, { type }).filter(c => c.score > 0.3);

    const context = topChunks.length
        ? topChunks.map((c, i) => `[Đoạn ${i + 1} - từ "${c.title}"]\n${c.chunk}`).join('\n\n')
        : '(Chưa có ngữ cảnh tham khảo nào được nạp — vẫn đánh giá dựa trên hiểu biết chung, độ tin cậy sẽ thấp hơn.)';

    const raw = await aiGateway.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Ngữ cảnh tham khảo:\n\n${context}\n\nBài viết cần kiểm tra:\n\n${content}` }
    ]);

    const parsed = extractJson(raw);
    const issues = Array.isArray(parsed) ? parsed.filter(it => it && typeof it === 'object') : [];

    return {
        [itemsKey]: issues,
        sources: topChunks.map(c => ({ title: c.title, chunk: c.chunk, score: c.score }))
    };
}

exports.factcheck = async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung bài viết.' });
    try {
        const result = await runRagCheck({
            content,
            type: 'approved-article',
            itemsKey: 'issues',
            systemPrompt: 'Bạn kiểm chứng dữ kiện cho bài báo. So sánh các nhận định/số liệu trong bài viết với các đoạn bài đã được duyệt trước đó (ngữ cảnh tham khảo). Liệt kê các nhận định có khả năng SAI, MÂU THUẪN với ngữ cảnh, hoặc THIẾU KIỂM CHỨNG. Trả về DUY NHẤT một mảng JSON: [{"claim":"...","issue":"...","severity":"cao|trung bình|thấp","suggestion":"..."}] (mảng rỗng nếu không có vấn đề gì). Không thêm chữ nào khác.'
        });
        res.json(result);
    } catch (err) {
        handleRagError(err, req, res, 'ragController.factcheck');
    }
};

exports.consistency = async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung bài viết.' });
    try {
        const result = await runRagCheck({
            content,
            type: 'style-guide',
            itemsKey: 'issues',
            systemPrompt: 'Bạn đối chiếu bài viết với cẩm nang/quy định văn phong tòa soạn (ngữ cảnh tham khảo). Liệt kê các đoạn chưa nhất quán về cách viết tên riêng, thuật ngữ, đơn vị hành chính, hoặc văn phong. Trả về DUY NHẤT một mảng JSON: [{"phrase":"...","issue":"...","severity":"cao|trung bình|thấp","suggestion":"..."}] (mảng rỗng nếu không có vấn đề gì). Không thêm chữ nào khác.'
        });
        res.json(result);
    } catch (err) {
        handleRagError(err, req, res, 'ragController.consistency');
    }
};
