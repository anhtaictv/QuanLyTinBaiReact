const jwt = require('jsonwebtoken');
const { poolPromise } = require('../config/db');
const { addSocket, removeSocket, isOnline } = require('./socketRegistry');
const { getMessageWithAttachments } = require('../controllers/chatController');
const { sendPushToUser } = require('../routes/pushRoutes');
const { logError } = require('../utils/errorLogger');

function initChatSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('NO_TOKEN'));
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('INVALID_TOKEN'));
            socket.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        const userId = socket.user.UserID;
        // Đăng ký hết listener ngay (đồng bộ) trước, tránh race condition: nếu client emit
        // ngay sau khi connect trong lúc phần join-room async bên dưới còn đang chạy, event
        // vẫn phải có listener sẵn để nhận, không bị rơi mất.
        let myConversationIds = [];

        (async () => {
            try {
                const pool = await poolPromise;
                const nameResult = await pool.request()
                    .input('UserID', userId)
                    .query('SELECT FullName FROM dbo.Users WHERE UserID = @UserID');
                const fullName = nameResult.recordset[0]?.FullName;
                addSocket(userId, socket.id, fullName);

                socket.join(`user:${userId}`);

                const convResult = await pool.request()
                    .input('UserID', userId)
                    .query('SELECT ConversationID FROM dbo.ConversationMembers WHERE UserID = @UserID');
                myConversationIds = convResult.recordset.map(r => r.ConversationID);
                for (const conversationId of myConversationIds) {
                    socket.join(`conv:${conversationId}`);
                    socket.to(`conv:${conversationId}`).emit('presence:update', { userId, online: true });
                }
            } catch (err) {
                logError({ source: 'chatSocket.connection', message: err.message, stack: err.stack, userId });
            }
        })();

        socket.on('conversation:join', async ({ conversationId }, ack) => {
            try {
                const pool = await poolPromise;
                const check = await pool.request()
                    .input('ConversationID', conversationId)
                    .input('UserID', userId)
                    .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
                if (!check.recordset.length) {
                    if (ack) ack({ error: 'Bạn không phải thành viên hội thoại này!' });
                    return;
                }
                socket.join(`conv:${conversationId}`);
                if (ack) ack({ success: true });
            } catch (err) {
                logError({ source: 'chatSocket.conversation:join', message: err.message, stack: err.stack, userId });
                if (ack) ack({ error: err.message });
            }
        });

        socket.on('conversation:leave', ({ conversationId }) => {
            socket.leave(`conv:${conversationId}`);
        });

        socket.on('message:send', async ({ conversationId, content }, ack) => {
            try {
                if (!content || !content.trim()) {
                    if (ack) ack({ error: 'Nội dung tin nhắn trống!' });
                    return;
                }
                const pool = await poolPromise;
                const check = await pool.request()
                    .input('ConversationID', conversationId)
                    .input('UserID', userId)
                    .query('SELECT 1 FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID AND UserID = @UserID');
                if (!check.recordset.length) {
                    if (ack) ack({ error: 'Bạn không phải thành viên hội thoại này!' });
                    return;
                }

                const insertResult = await pool.request()
                    .input('ConversationID', conversationId)
                    .input('SenderID', userId)
                    .input('Content', content)
                    .query(`
                        INSERT INTO dbo.Messages (ConversationID, SenderID, Content, CreatedAt)
                        OUTPUT INSERTED.MessageID
                        VALUES (@ConversationID, @SenderID, @Content, GETDATE())
                    `);
                const messageId = insertResult.recordset[0].MessageID;

                await pool.request()
                    .input('ConversationID', conversationId)
                    .query('UPDATE dbo.Conversations SET LastMessageAt = GETDATE() WHERE ConversationID = @ConversationID');

                const message = await getMessageWithAttachments(pool, messageId);

                io.to(`conv:${conversationId}`).emit('message:new', message);
                if (ack) ack({ success: true, message });

                // Push cho thành viên không online (không có socket nào đang mở)
                const membersResult = await pool.request()
                    .input('ConversationID', conversationId)
                    .query('SELECT UserID FROM dbo.ConversationMembers WHERE ConversationID = @ConversationID');
                const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
                for (const row of membersResult.recordset) {
                    if (row.UserID === userId) continue;
                    if (!isOnline(row.UserID)) {
                        sendPushToUser(row.UserID, message.SenderName, preview, `/chat/${conversationId}`)
                            .catch(err => console.warn('⚠️ [Chat Push] lỗi:', err.message));
                    }
                }
            } catch (err) {
                logError({ source: 'chatSocket.message:send', message: err.message, stack: err.stack, userId });
                if (ack) ack({ error: err.message });
            }
        });

        socket.on('typing:start', ({ conversationId }) => {
            socket.to(`conv:${conversationId}`).emit('typing:update', { userId, conversationId, isTyping: true });
        });

        socket.on('typing:stop', ({ conversationId }) => {
            socket.to(`conv:${conversationId}`).emit('typing:update', { userId, conversationId, isTyping: false });
        });

        socket.on('message:read', async ({ conversationId, lastMessageId }) => {
            try {
                const pool = await poolPromise;
                await pool.request()
                    .input('ConversationID', conversationId)
                    .input('UserID', userId)
                    .input('LastMessageID', lastMessageId)
                    .query(`
                        UPDATE dbo.ConversationMembers
                        SET LastReadMessageID = @LastMessageID
                        WHERE ConversationID = @ConversationID AND UserID = @UserID
                          AND (LastReadMessageID IS NULL OR LastReadMessageID < @LastMessageID)
                    `);
                socket.to(`conv:${conversationId}`).emit('read:update', { conversationId, userId, lastMessageId });
                io.to(`user:${userId}`).emit('unread:update', { conversationId, lastMessageId });
            } catch (err) {
                logError({ source: 'chatSocket.message:read', message: err.message, stack: err.stack, userId });
            }
        });

        socket.on('disconnect', () => {
            removeSocket(userId, socket.id);
            if (!isOnline(userId)) {
                for (const conversationId of myConversationIds) {
                    socket.to(`conv:${conversationId}`).emit('presence:update', { userId, online: false });
                }
            }
        });
    });
}

module.exports = { initChatSocket };
