const aiGateway = require('../services/aiGatewayClient');
const ragStore = require('../services/ragStore');
const { logError } = require('../utils/errorLogger');

function handleRagError(err, req, res, source) {
    if (err instanceof aiGateway.AiGatewayUnavailableError) {
        return res.status(503).json({ error: err.message, connected: false });
    }
    logError({ source, message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại sau!' });
}

exports.ingest = async (req, res) => {
    const { title, content } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu tiêu đề văn bản.' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Thiếu nội dung văn bản.' });
    try {
        const result = await ragStore.addDocument(title.trim(), content);
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
