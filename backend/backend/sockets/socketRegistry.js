// Theo dõi user nào đang online (in-memory, 1 instance server).
// Map<UserID, Set<socketId>> — 1 user có thể mở nhiều tab/thiết bị cùng lúc.
const userSockets = new Map();
// Cache FullName để không phải query DB mỗi khi gửi tin nhắn.
const userNames = new Map();

function addSocket(userId, socketId, fullName) {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socketId);
    if (fullName) userNames.set(userId, fullName);
}

function removeSocket(userId, socketId) {
    const set = userSockets.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(userId);
}

function isOnline(userId) {
    return userSockets.has(userId);
}

function getFullName(userId) {
    return userNames.get(userId);
}

module.exports = { addSocket, removeSocket, isOnline, getFullName };
