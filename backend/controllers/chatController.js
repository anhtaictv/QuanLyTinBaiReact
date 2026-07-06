const path = require('path');
const fs = require('fs');
const { sql, poolPromise } = require('../config/db');
const { logError } = require('../utils/errorLogger');
const { isOnline } = require('../sockets/socketRegistry');
const { isImageFile, STORAGE_ROOT } = require('../config/chatUpload');
const { getIO } = require('../sockets/ioHolder');
const { packContent, unpackContent } = require('../utils/messageCompression');

const GROUP_CREATOR_ROLES = ['admin', 'trưởng ban', 'thư ký'];

function canManageGroups(req) {
    const role = (req.user.Role || req.user.role || '').toLowerCase();
    return GROUP_CREATOR_ROLES.includes(role);
}

// Trả về 1 message kèm tên người gửi + danh sách file đính kèm (dùng chung cho REST và socket).
async function getMessageWithAttachments(pool, messageId) {
    const msgResult = await pool.request()
        .input('MessageID', messageId)
        .query(`
            SELECT m.MessageID, m.ConversationID, m.SenderID, u.FullName AS SenderName, m.Content, m.ContentBin, m.IsCompressed, m.CreatedAt,
                   m.IsEdited, m.EditedAt, m.IsRecalled
            FROM dbo.Messages m
            JOIN dbo.Users u ON u.UserID = m.SenderID
            WHERE m.MessageID = @MessageID
        `);
    const message = unpackContent(msgResult.recordset[0]);
    if (!message) return null;

    // Tin nhắn đã thu hồi: không trả nội dung/đính kèm gốc cho client.
    if (message.IsRecalled) {
        message.Content = null;
        message.Attachments = [];
        return message;
    }

    const attResult = await pool.request()
        .input('MessageID', messageId)
        .query(`
            SELECT AttachmentID, StoredPath, OriginalName, MimeType, SizeBytes, IsImage
            FROM dbo.MessageAttachments
            WHERE MessageID = @MessageID
        `);
    message.Attachments = attResult.recordset || [];
    return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations
// ─────────────────────────────────────────────────────────────────────────────
exports.getConversations = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;

        const result = await pool.request()
            .input('UserID', userId)
            .query(`
                SELECT
                    c.ConversationID, c.IsGroup, c.Title, c.LastMessageAt,
                    cm.LastReadMessageID, cm.IsAdmin AS MyIsAdmin,
                    (SELECT COUNT(*) FROM dbo.Messages m
                     WHERE m.ConversationID = c.ConversationID AND m.IsDeleted = 0
                       AND m.MessageID > ISNULL(cm.LastReadMessageID, 0)
                       AND NOT EXISTS (SELECT 1 FROM dbo.MessageHiddenFor hf WHERE hf.MessageID = m.MessageID AND hf.UserID = @UserID)) AS UnreadCount,
                    (SELECT TOP 1 m2.MessageID
                     FROM dbo.Messages m2
                     WHERE m2.ConversationID = c.ConversationID AND m2.IsDeleted = 0
                       AND NOT EXISTS (SELECT 1 FROM dbo.MessageHiddenFor hf2 WHERE hf2.MessageID = m2.MessageID AND hf2.UserID = @UserID)
                     ORDER BY m2.MessageID DESC) AS LastMessageID,
                    (SELECT TOP 1 ocm.UserID FROM dbo.ConversationMembers ocm
                     WHERE ocm.ConversationID = c.ConversationID AND ocm.UserID <> @UserID) AS OtherMemberID,
                    (SELECT TOP 1 u.FullName FROM dbo.ConversationMembers ocm
                     JOIN dbo.Users u ON u.UserID = ocm.UserID
                     WHERE ocm.ConversationID = c.ConversationID AND ocm.UserID <> @UserID) AS OtherMemberName
                FROM dbo.Conversations c
                JOIN dbo.ConversationMembers cm ON cm.ConversationID = c.ConversationID AND cm.UserID = @UserID
                ORDER BY c.LastMessageAt DESC
            `);

        const rows = result.recordset || [];
        const lastMessageIds = rows.map(c => c.LastMessageID).filter(Boolean);

        let lastMessageById = {};
        if (lastMessageIds.length) {
            const idList = lastMessageIds.join(',');
            const lastMsgResult = await pool.request().query(`
                SELECT MessageID, Content, ContentBin, IsCompressed, IsRecalled
                FROM dbo.Messages
                WHERE MessageID IN (${idList})
            `);
            for (const row of lastMsgResult.recordset || []) {
                const unpacked = unpackContent(row);
                lastMessageById[unpacked.MessageID] = unpacked.IsRecalled ? 'Tin nhắn đã được thu hồi' : unpacked.Content;
            }
        }

        const conversations = rows.map(c => ({
            ...c,
            LastMessage: c.LastMessageID ? lastMessageById[c.LastMessageID] : null,
            DisplayName: c.IsGroup ? c.Title : c.OtherMemberName,
            OtherMemberOnline: !c.IsGroup && c.OtherMemberID ? isOnline(c.OtherMemberID) : undefined
        }));

        res.json(conversations);
    } catch (err) {
        logError({ source: 'chatController.getConversations', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id/messages?before=&limit=
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const conversationId = parseInt(req.params.id);
        const before = parseInt(req.query.before) || null;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const memberCheck = await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', userId)
            .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
        if (!memberCheck.recordset.length) {
            return res.status(403).json({ error: 'Bạn không phải thành viên hội thoại này!' });
        }

        const request = pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', userId)
            .input('Limit', limit);
        let beforeClause = '';
        if (before) {
            request.input('Before', before);
            beforeClause = 'AND m.MessageID < @Before';
        }

        const msgResult = await request.query(`
            SELECT TOP (@Limit) m.MessageID, m.ConversationID, m.SenderID, u.FullName AS SenderName, m.Content, m.ContentBin, m.IsCompressed, m.CreatedAt,
                   m.IsEdited, m.EditedAt, m.IsRecalled
            FROM dbo.Messages m
            JOIN dbo.Users u ON u.UserID = m.SenderID
            WHERE m.ConversationID = @ConversationID AND m.IsDeleted = 0 ${beforeClause}
              AND NOT EXISTS (SELECT 1 FROM dbo.MessageHiddenFor hf WHERE hf.MessageID = m.MessageID AND hf.UserID = @UserID)
            ORDER BY m.MessageID DESC
        `);

        const messages = (msgResult.recordset || []).map(unpackContent);
        const messageIds = messages.map(m => m.MessageID);

        let attachmentsByMessage = {};
        if (messageIds.length) {
            const idList = messageIds.join(',');
            const attResult = await pool.request().query(`
                SELECT AttachmentID, MessageID, StoredPath, OriginalName, MimeType, SizeBytes, IsImage
                FROM dbo.MessageAttachments
                WHERE MessageID IN (${idList})
            `);
            for (const att of attResult.recordset || []) {
                if (!attachmentsByMessage[att.MessageID]) attachmentsByMessage[att.MessageID] = [];
                attachmentsByMessage[att.MessageID].push(att);
            }
        }

        const withAttachments = messages.map(m => ({
            ...m,
            Content: m.IsRecalled ? null : m.Content,
            Attachments: m.IsRecalled ? [] : (attachmentsByMessage[m.MessageID] || [])
        }));
        withAttachments.reverse(); // trả về cũ -> mới

        res.json(withAttachments);
    } catch (err) {
        logError({ source: 'chatController.getMessages', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/conversations
// body: { memberIds: [int], isGroup: bool, title?: string }
// ─────────────────────────────────────────────────────────────────────────────
exports.createConversation = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const { memberIds, isGroup, title } = req.body;

        if (!Array.isArray(memberIds) || !memberIds.length) {
            return res.status(400).json({ error: 'Thiếu danh sách thành viên!' });
        }

        if (isGroup && !canManageGroups(req)) {
            return res.status(403).json({ error: 'Bạn không có quyền tạo nhóm chat!' });
        }

        // 1-1: nếu đã tồn tại hội thoại giữa 2 người thì trả về hội thoại cũ, không tạo trùng.
        if (!isGroup) {
            const otherId = memberIds[0];
            const existing = await pool.request()
                .input('Me', userId)
                .input('Other', otherId)
                .query(`
                    SELECT c.ConversationID
                    FROM dbo.Conversations c
                    WHERE c.IsGroup = 0
                      AND EXISTS (SELECT 1 FROM dbo.ConversationMembers m1 WHERE m1.ConversationID = c.ConversationID AND m1.UserID = @Me)
                      AND EXISTS (SELECT 1 FROM dbo.ConversationMembers m2 WHERE m2.ConversationID = c.ConversationID AND m2.UserID = @Other)
                      AND (SELECT COUNT(*) FROM dbo.ConversationMembers m3 WHERE m3.ConversationID = c.ConversationID) = 2
                `);
            if (existing.recordset.length) {
                return res.json({ success: true, conversationId: existing.recordset[0].ConversationID, alreadyExists: true });
            }
        }

        const insertConv = await pool.request()
            .input('IsGroup', isGroup ? 1 : 0)
            .input('Title', isGroup ? (title || 'Nhóm chat') : null)
            .input('CreatedBy', userId)
            .query(`
                INSERT INTO dbo.Conversations (IsGroup, Title, CreatedBy, CreatedAt, LastMessageAt)
                OUTPUT INSERTED.ConversationID
                VALUES (@IsGroup, @Title, @CreatedBy, GETDATE(), GETDATE())
            `);
        const conversationId = insertConv.recordset[0].ConversationID;

        const allMemberIds = Array.from(new Set([userId, ...memberIds]));
        for (const memberId of allMemberIds) {
            await pool.request()
                .input('ConversationID', conversationId)
                .input('UserID', memberId)
                .input('IsAdmin', memberId === userId ? 1 : 0)
                .query(`
                    INSERT INTO dbo.ConversationMembers (ConversationID, UserID, JoinedAt, IsAdmin)
                    VALUES (@ConversationID, @UserID, GETDATE(), @IsAdmin)
                `);
        }

        res.json({ success: true, conversationId });
    } catch (err) {
        logError({ source: 'chatController.createConversation', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id/members
// ─────────────────────────────────────────────────────────────────────────────
exports.getMembers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const conversationId = parseInt(req.params.id);

        const memberCheck = await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', userId)
            .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
        if (!memberCheck.recordset.length) {
            return res.status(403).json({ error: 'Bạn không phải thành viên hội thoại này!' });
        }

        const result = await pool.request()
            .input('ConversationID', conversationId)
            .query(`
                SELECT cm.UserID, cm.IsAdmin, u.FullName
                FROM dbo.ConversationMembers cm
                JOIN dbo.Users u ON u.UserID = cm.UserID
                WHERE cm.ConversationID = @ConversationID
                ORDER BY cm.IsAdmin DESC, u.FullName ASC
            `);

        res.json(result.recordset || []);
    } catch (err) {
        logError({ source: 'chatController.getMembers', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/conversations/:id/members  { userId }
// ─────────────────────────────────────────────────────────────────────────────
exports.addMember = async (req, res) => {
    try {
        const pool = await poolPromise;
        const requesterId = req.user.UserID;
        const conversationId = parseInt(req.params.id);
        const { userId } = req.body;

        const perm = await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', requesterId)
            .query('SELECT IsAdmin FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
        if (!perm.recordset.length || !perm.recordset[0].IsAdmin) {
            return res.status(403).json({ error: 'Bạn không có quyền thêm thành viên vào nhóm này!' });
        }

        const already = await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', userId)
            .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
        if (already.recordset.length) {
            return res.json({ success: true, alreadyMember: true });
        }

        await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', userId)
            .query(`
                INSERT INTO dbo.ConversationMembers (ConversationID, UserID, JoinedAt, IsAdmin)
                VALUES (@ConversationID, @UserID, GETDATE(), 0)
            `);

        res.json({ success: true });
    } catch (err) {
        logError({ source: 'chatController.addMember', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/conversations/:id/members/:userId
// ─────────────────────────────────────────────────────────────────────────────
exports.removeMember = async (req, res) => {
    try {
        const pool = await poolPromise;
        const requesterId = req.user.UserID;
        const conversationId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);

        // Cho phép: admin nhóm xóa người khác, hoặc tự rời nhóm.
        if (requesterId !== targetUserId) {
            const perm = await pool.request()
                .input('ConversationID', conversationId)
                .input('UserID', requesterId)
                .query('SELECT IsAdmin FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
            if (!perm.recordset.length || !perm.recordset[0].IsAdmin) {
                return res.status(403).json({ error: 'Bạn không có quyền xóa thành viên khỏi nhóm này!' });
            }
        }

        await pool.request()
            .input('ConversationID', conversationId)
            .input('UserID', targetUserId)
            .query('DELETE FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');

        res.json({ success: true });
    } catch (err) {
        logError({ source: 'chatController.removeMember', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/upload  (multipart/form-data: file, messageId)
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Không có file' });

        const pool = await poolPromise;
        const messageId = parseInt(req.body.messageId);
        const userId = req.user.UserID;

        const msgResult = await pool.request()
            .input('MessageID', messageId)
            .query('SELECT ConversationID, SenderID FROM dbo.Messages WHERE MessageID = @MessageID');
        const msg = msgResult.recordset[0];
        if (!msg || msg.SenderID !== userId) {
            return res.status(403).json({ error: 'Không thể đính kèm file vào tin nhắn này!' });
        }

        const now = new Date();
        const datePart = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
        const storedPath = `ChatStorage/${datePart}/${req.file.filename}`;
        const isImage = isImageFile(req.file.originalname);

        const insertResult = await pool.request()
            .input('MessageID', messageId)
            .input('StoredPath', storedPath)
            .input('OriginalName', req.file.originalname)
            .input('MimeType', req.file.mimetype)
            .input('SizeBytes', req.file.size)
            .input('IsImage', isImage ? 1 : 0)
            .query(`
                INSERT INTO dbo.MessageAttachments (MessageID, StoredPath, OriginalName, MimeType, SizeBytes, IsImage)
                OUTPUT INSERTED.AttachmentID
                VALUES (@MessageID, @StoredPath, @OriginalName, @MimeType, @SizeBytes, @IsImage)
            `);

        const attachmentId = insertResult.recordset[0].AttachmentID;

        // Phát lại message đầy đủ (kèm attachment mới) cho mọi người trong hội thoại
        const updatedMessage = await getMessageWithAttachments(pool, messageId);
        const io = getIO();
        if (io) io.to(`conv:${msg.ConversationID}`).emit('message:new', updatedMessage);

        res.json({ success: true, attachmentId, storedPath, isImage });
    } catch (err) {
        logError({ source: 'chatController.uploadAttachment', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/download?path=ChatStorage/2026/07/05/xxx.jpg
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadAttachment = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Thiếu đường dẫn file' });

        // Chỉ cho tải nếu người gọi là thành viên của hội thoại chứa file này.
        const attResult = await pool.request()
            .input('StoredPath', filePath)
            .query(`
                SELECT m.ConversationID FROM dbo.MessageAttachments a
                JOIN dbo.Messages m ON m.MessageID = a.MessageID
                WHERE a.StoredPath = @StoredPath
            `);
        const att = attResult.recordset[0];
        if (!att) return res.status(404).json({ error: 'File không tồn tại' });

        const memberCheck = await pool.request()
            .input('ConversationID', att.ConversationID)
            .input('UserID', userId)
            .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
        if (!memberCheck.recordset.length) {
            return res.status(403).json({ error: 'Bạn không có quyền truy cập file này!' });
        }

        const cleaned = filePath.replace(/^ChatStorage\//, '');
        const fullPath = path.resolve(STORAGE_ROOT, 'ChatStorage', cleaned);
        const rootResolved = path.resolve(STORAGE_ROOT, 'ChatStorage');

        if (!fullPath.startsWith(rootResolved)) {
            return res.status(403).json({ error: 'Truy cập bị từ chối' });
        }
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File không tồn tại' });
        }

        res.sendFile(fullPath);
    } catch (err) {
        logError({ source: 'chatController.downloadAttachment', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/chat/messages/:id  { content }
// ─────────────────────────────────────────────────────────────────────────────
exports.editMessage = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const messageId = parseInt(req.params.id);
        const content = (req.body.content || '').trim();

        if (!content) {
            return res.status(400).json({ error: 'Nội dung tin nhắn trống!' });
        }

        const msgResult = await pool.request()
            .input('MessageID', messageId)
            .query('SELECT ConversationID, SenderID, IsRecalled FROM dbo.Messages WHERE MessageID = @MessageID AND IsDeleted = 0');
        const msg = msgResult.recordset[0];
        if (!msg || msg.SenderID !== userId) {
            return res.status(403).json({ error: 'Bạn không thể sửa tin nhắn này!' });
        }
        if (msg.IsRecalled) {
            return res.status(400).json({ error: 'Tin nhắn đã bị thu hồi, không thể sửa!' });
        }

        const packed = packContent(content);
        await pool.request()
            .input('MessageID', messageId)
            .input('Content', packed.content)
            .input('ContentBin', sql.VarBinary(sql.MAX), packed.contentBin)
            .input('IsCompressed', packed.isCompressed)
            .query(`
                UPDATE dbo.Messages
                SET Content = @Content, ContentBin = @ContentBin, IsCompressed = @IsCompressed, IsEdited = 1, EditedAt = GETDATE()
                WHERE MessageID = @MessageID
            `);

        const updatedMessage = await getMessageWithAttachments(pool, messageId);
        const io = getIO();
        if (io) io.to(`conv:${msg.ConversationID}`).emit('message:edited', updatedMessage);

        res.json({ success: true, message: updatedMessage });
    } catch (err) {
        logError({ source: 'chatController.editMessage', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/messages/:id/recall — thu hồi với mọi người (giống Zalo)
// ─────────────────────────────────────────────────────────────────────────────
exports.recallMessage = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const messageId = parseInt(req.params.id);

        const msgResult = await pool.request()
            .input('MessageID', messageId)
            .query('SELECT ConversationID, SenderID FROM dbo.Messages WHERE MessageID = @MessageID AND IsDeleted = 0');
        const msg = msgResult.recordset[0];
        if (!msg || msg.SenderID !== userId) {
            return res.status(403).json({ error: 'Bạn không thể thu hồi tin nhắn này!' });
        }

        await pool.request()
            .input('MessageID', messageId)
            .query(`
                UPDATE dbo.Messages
                SET IsRecalled = 1, RecalledAt = GETDATE()
                WHERE MessageID = @MessageID
            `);

        const updatedMessage = await getMessageWithAttachments(pool, messageId);
        const io = getIO();
        if (io) io.to(`conv:${msg.ConversationID}`).emit('message:recalled', updatedMessage);

        res.json({ success: true, message: updatedMessage });
    } catch (err) {
        logError({ source: 'chatController.recallMessage', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/messages/:id — xoá chỉ ở phía mình, không ảnh hưởng người khác
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteMessageForMe = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.UserID;
        const messageId = parseInt(req.params.id);

        const memberCheck = await pool.request()
            .input('MessageID', messageId)
            .input('UserID', userId)
            .query(`
                SELECT m.ConversationID FROM dbo.Messages m
                JOIN dbo.ConversationMembers cm ON cm.ConversationID = m.ConversationID AND cm.UserID = @UserID
                WHERE m.MessageID = @MessageID
            `);
        if (!memberCheck.recordset.length) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá tin nhắn này!' });
        }
        const conversationId = memberCheck.recordset[0].ConversationID;

        await pool.request()
            .input('MessageID', messageId)
            .input('UserID', userId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM dbo.MessageHiddenFor WHERE MessageID = @MessageID AND UserID = @UserID)
                INSERT INTO dbo.MessageHiddenFor (MessageID, UserID) VALUES (@MessageID, @UserID)
            `);

        // Chỉ báo lại cho chính người dùng này (các tab/thiết bị khác) — không ảnh hưởng người khác.
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('message:deletedForMe', { messageId, conversationId });

        res.json({ success: true });
    } catch (err) {
        logError({ source: 'chatController.deleteMessageForMe', message: err.message, stack: err.stack, userId: req.user?.UserID, method: req.method, path: req.originalUrl });
        res.status(500).json({ error: err.message });
    }
};

exports.getMessageWithAttachments = getMessageWithAttachments;
exports.canManageGroups = canManageGroups;
