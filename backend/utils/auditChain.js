const crypto = require('crypto');

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

// Ghi 1 mắt xích vào chuỗi hash chống sửa ngầm cho 1 bài viết. Mỗi lần duyệt bài (dù qua
// nhánh nào trong 3 nhánh approve hiện có) gọi hàm này SAU KHI đã ghi đè xong dữ liệu/file
// cuối cùng, để hash phản ánh đúng nội dung đã lưu.
// contentBuffer: bytes của file đã duyệt (nếu có file), hoặc chuỗi JSON Content của Posts
// khi bài không có file đính kèm (duyệt trạng thái đơn thuần).
async function recordApproval(pool, { postId, title, contentBuffer, approvedBy, source }) {
    const contentHash = sha256(contentBuffer);

    const prevResult = await pool.request()
        .input('PostID', postId)
        .query('SELECT TOP 1 ChainHash FROM dbo.PostApprovalAudit WHERE PostID = @PostID ORDER BY AuditID DESC');
    const prevChainHash = prevResult.recordset[0]?.ChainHash || null;

    const chainHash = sha256((prevChainHash || '') + contentHash);

    await pool.request()
        .input('PostID', postId)
        .input('Title', title || '')
        .input('ContentHash', contentHash)
        .input('PrevChainHash', prevChainHash)
        .input('ChainHash', chainHash)
        .input('ApprovedBy', approvedBy)
        .input('Source', source)
        .query(`
            INSERT INTO dbo.PostApprovalAudit (PostID, Title, ContentHash, PrevChainHash, ChainHash, ApprovedBy, Source)
            VALUES (@PostID, @Title, @ContentHash, @PrevChainHash, @ChainHash, @ApprovedBy, @Source)
        `);

    return { contentHash, prevChainHash, chainHash };
}

// Đi lại toàn bộ chuỗi, tính lại ChainHash từng dòng từ ContentHash+PrevChainHash lưu sẵn
// và so với ChainHash đã lưu — lệch ở đâu nghĩa là dữ liệu bị sửa trực tiếp ngoài luồng ở đó.
function verifyChain(rows) {
    let prevChainHash = null;
    for (const row of rows) {
        if (row.PrevChainHash !== prevChainHash) return false;
        const expected = sha256((row.PrevChainHash || '') + row.ContentHash);
        if (expected !== row.ChainHash) return false;
        prevChainHash = row.ChainHash;
    }
    return true;
}

module.exports = { sha256, recordApproval, verifyChain };
