import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getConversations } from '../services/chatService';
import { useChatSocket } from '../hooks/useChatSocket';
import { showToastSuccess } from '../utils/Toast';
import { IconChat } from './icons';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

const PANEL_WIDTH = 320;

// Icon chuông tin nhắn — cập nhật số chưa đọc real-time qua socket
// (message:new / read:update / unread:update) thay vì poll định kỳ như ErrorBell.
const ChatBell = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const pos = useDropdownPosition(open, buttonRef, PANEL_WIDTH);
  const socket = useChatSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const openConversationIdRef = useRef(null);
  const currentUserId = (JSON.parse(localStorage.getItem('user')) || {}).UserID;

  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/(\d+)/);
    openConversationIdRef.current = match ? Number(match[1]) : null;
  }, [location.pathname]);

  const fetchConversations = async () => {
    try {
      const res = await getConversations();
      const list = res.data || [];
      setConversations(list);
      setCount(list.reduce((sum, c) => sum + (c.UnreadCount || 0), 0));
      return list;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const handleNewMessage = (message) => {
      const isOwnMessage = message.SenderID === currentUserId;
      const isViewingThisConversation = openConversationIdRef.current === message.ConversationID;
      const shouldCountUnread = !isOwnMessage && !isViewingThisConversation;

      setConversations(prev => {
        const exists = prev.some(c => c.ConversationID === message.ConversationID);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev.map(c => c.ConversationID === message.ConversationID
          ? { ...c, LastMessage: message.Content, UnreadCount: shouldCountUnread ? (c.UnreadCount || 0) + 1 : (isOwnMessage ? c.UnreadCount : 0) }
          : c
        );
      });

      if (!shouldCountUnread) return;

      setCount(prev => prev + 1);
      showToastSuccess(`${message.SenderName}: ${message.Content || '[Đính kèm]'}`);
    };

    const handleUnreadUpdate = () => {
      fetchConversations();
    };

    // Sửa / thu hồi / xoá-chỉ-mình đều có thể làm thay đổi LastMessage hoặc số chưa đọc
    // hiển thị trên chuông — đơn giản và chắc chắn nhất là đồng bộ lại từ server.
    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleUnreadUpdate);
    socket.on('message:recalled', handleUnreadUpdate);
    socket.on('message:deletedForMe', handleUnreadUpdate);
    socket.on('unread:update', handleUnreadUpdate);
    socket.on('read:update', handleUnreadUpdate);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleUnreadUpdate);
      socket.off('message:recalled', handleUnreadUpdate);
      socket.off('message:deletedForMe', handleUnreadUpdate);
      socket.off('unread:update', handleUnreadUpdate);
      socket.off('read:update', handleUnreadUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openPanel = async () => {
    setOpen(prev => !prev);
    if (!open) {
      setLoading(true);
      await fetchConversations();
      setLoading(false);
    }
  };

  const goToConversation = (conversationId) => {
    setOpen(false);
    navigate(`/chat/${conversationId}`);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={openPanel}
        title="Tin nhắn"
        aria-label="Tin nhắn"
        style={{
          width: 34, height: 34, borderRadius: 'var(--radius-sm)',
          background: count > 0 ? 'var(--sidebar-active)' : 'rgba(255,255,255,0.06)',
          border: '1px solid var(--sidebar-border)',
          color: 'var(--sidebar-fg)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}
      >
        <IconChat size={16} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--danger)', color: 'white',
            borderRadius: '999px', fontSize: '11px',
            minWidth: 16, height: 16, lineHeight: '16px',
            textAlign: 'center', fontWeight: 'bold', padding: '0 3px'
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 500,
          width: PANEL_WIDTH, maxWidth: 'calc(100vw - 16px)', maxHeight: 420, overflowY: 'auto',
          background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          padding: 12
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Tin nhắn</strong>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 10 }}>Đang tải...</div>
          ) : conversations.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 10 }}>Chưa có hội thoại nào</div>
          ) : (
            conversations.map(c => (
              <div
                key={c.ConversationID}
                className="hoverable-row"
                onClick={() => goToConversation(c.ConversationID)}
                style={{
                  borderBottom: '1px solid var(--border)', padding: '8px 4px',
                  cursor: 'pointer',
                  fontWeight: c.UnreadCount > 0 ? 700 : 400
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{c.DisplayName || 'Hội thoại'}</span>
                  {c.UnreadCount > 0 && (
                    <span style={{
                      background: 'var(--danger)', color: 'white', borderRadius: '999px',
                      fontSize: 11, minWidth: 16, height: 16, lineHeight: '16px',
                      textAlign: 'center', padding: '0 3px'
                    }}>
                      {c.UnreadCount > 99 ? '99+' : c.UnreadCount}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.LastMessage || '(chưa có tin nhắn)'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ChatBell;
