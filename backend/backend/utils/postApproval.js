const ragStore = require('../services/ragStore');
const { recordApproval } = require('./auditChain');
const { logError } = require('./errorLogger');

// Nạp bài vào corpus fact-check + ghi audit-trail — dùng chung ở cả 3 nhánh "duyệt bài"
// (newsController.approveNews, newsController.editorApprove, driveRoutes.complete). Không
// chặn phản hồi cho người dùng nếu bước này lỗi (RAG Gateway tắt, DB tạm trục trặc...) —
// đây là tính năng giám sát bổ sung, không phải điều kiện để duyệt bài thành công.
async function afterApprove(pool, { postId, title, contentBuffer, approvedBy, source, ragText }) {
    try {
        if (ragText && ragText.trim()) {
            await ragStore.ingestApprovedArticle(postId, title, ragText);
        }
    } catch (err) {
        logError({ source: 'postApproval.afterApprove(rag)', message: err.message, stack: err.stack, userId: approvedBy });
    }
    try {
        await recordApproval(pool, { postId, title, contentBuffer, approvedBy, source });
    } catch (err) {
        logError({ source: 'postApproval.afterApprove(audit)', message: err.message, stack: err.stack, userId: approvedBy });
    }
}

module.exports = { afterApprove };
