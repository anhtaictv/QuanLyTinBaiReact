import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getConversations } from '../services/chatService';
import { useChatSocket } from '../hooks/useChatSocket';
import ConversationList from '../components/chat/ConversationList';
import MessageThread from '../components/chat/MessageThread';
import NewChatModal from '../components/chat/NewChatModal';

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const socket = useChatSocket();

  const userObj = JSON.parse(localStorage.getItem('user')) || {};
  const currentUserId = userObj.UserID;
  const currentUserRole = userObj.Role || userObj.role;

  const fetchConversations = () => {
    getConversations().then(res => setConversations(res.data || [])).catch(() => {});
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const handleNewMessage = (message) => {
      setConversations(prev => {
        const exists = prev.some(c => c.ConversationID === message.ConversationID);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev
          .map(c => c.ConversationID === message.ConversationID
            ? { ...c, LastMessage: message.Content, LastMessageAt: message.CreatedAt, UnreadCount: message.ConversationID === Number(conversationId) ? 0 : (c.UnreadCount || 0) + 1 }
            : c
          )
          .sort((a, b) => new Date(b.LastMessageAt) - new Date(a.LastMessageAt));
      });
    };
    const handlePresence = ({ userId, online }) => {
      setConversations(prev => prev.map(c => c.OtherMemberID === userId ? { ...c, OtherMemberOnline: online } : c));
    };
    // Sửa/thu hồi/xoá-chỉ-mình đều có thể đổi LastMessage hoặc số chưa đọc hiển thị ở
    // sidebar — đồng bộ lại từ server cho chắc (giống cách ChatBell xử lý các sự kiện này).
    const handleMutated = () => fetchConversations();
    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleMutated);
    socket.on('message:recalled', handleMutated);
    socket.on('message:deletedForMe', handleMutated);
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleMutated);
      socket.off('message:recalled', handleMutated);
      socket.off('message:deletedForMe', handleMutated);
      socket.off('presence:update', handlePresence);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId]);

  const selectedConversation = conversations.find(c => c.ConversationID === Number(conversationId));

  const handleSelect = (id) => navigate(`/chat/${id}`);

  const handleCreated = (newConversationId) => {
    setShowNewChat(false);
    fetchConversations();
    navigate(`/chat/${newConversationId}`);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <ConversationList
        conversations={conversations}
        selectedId={Number(conversationId)}
        onSelect={handleSelect}
        onNewChat={() => setShowNewChat(true)}
      />
      {selectedConversation ? (
        <MessageThread
          key={selectedConversation.ConversationID}
          conversation={selectedConversation}
          currentUserId={currentUserId}
          socket={socket}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg)' }}>
          Chọn 1 hội thoại hoặc bắt đầu tin nhắn mới
        </div>
      )}

      {showNewChat && (
        <NewChatModal
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setShowNewChat(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default Chat;
