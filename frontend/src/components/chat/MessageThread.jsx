import React, { useEffect, useRef, useState } from 'react';
import { getMessages, uploadChatFile } from '../../services/chatService';
import MessageComposer from './MessageComposer';
import GroupMembersModal from './GroupMembersModal';
import { IconSettings, IconFileText } from '../icons';
import LoadingState from '../LoadingState';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const AttachmentView = ({ att, mine }) => {
  if (att.IsImage) {
    return (
      <a href={`${BASE_URL}/chat/download?path=${encodeURIComponent(att.StoredPath)}`} target="_blank" rel="noreferrer">
        <img src={`${BASE_URL}/chat/download?path=${encodeURIComponent(att.StoredPath)}`} alt={att.OriginalName} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, marginTop: 4, display: 'block' }} />
      </a>
    );
  }
  return (
    <a
      href={`${BASE_URL}/chat/download?path=${encodeURIComponent(att.StoredPath)}`}
      target="_blank" rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: mine ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)',
        padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginTop: 4, fontSize: 12,
        textDecoration: 'none', color: 'inherit'
      }}
    >
      <IconFileText size={13} />{att.OriginalName}
    </a>
  );
};

const MessageThread = ({ conversation, currentUserId, socket }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef(null);
  const conversationId = conversation.ConversationID;

  const markRead = (lastMessageId) => {
    if (lastMessageId) socket.emit('message:read', { conversationId, lastMessageId });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMessages(conversationId).then(res => {
      if (cancelled) return;
      setMessages(res.data || []);
      setLoading(false);
      const last = (res.data || [])[res.data.length - 1];
      if (last) markRead(last.MessageID);
    }).catch(() => setLoading(false));

    socket.emit('conversation:join', { conversationId });

    return () => {
      cancelled = true;
      socket.emit('conversation:leave', { conversationId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message.ConversationID !== conversationId) return;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.MessageID === message.MessageID);
        if (idx === -1) return [...prev, message];
        const next = [...prev];
        next[idx] = message;
        return next;
      });
      if (message.SenderID !== currentUserId) markRead(message.MessageID);
    };

    const handleTyping = ({ conversationId: cid, userId, isTyping }) => {
      if (cid !== conversationId || userId === currentUserId) return;
      setTypingUser(isTyping ? userId : null);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:update', handleTyping);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:update', handleTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, socket, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTypingChange = (isTyping) => {
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  };

  const handleSend = (text, files) => {
    socket.emit('message:send', { conversationId, content: text || (files.length ? '[Đính kèm]' : '') }, async (ack) => {
      if (ack?.error) return;
      const messageId = ack?.message?.MessageID;
      if (messageId && files.length) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('messageId', messageId);
          try {
            await uploadChatFile(formData);
          } catch {
            // best-effort: file đính kèm lỗi không chặn phần text đã gửi
          }
        }
      }
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {!conversation.IsGroup && (
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 7,
              background: conversation.OtherMemberOnline ? 'var(--success)' : 'var(--text-muted)'
            }} />
          )}
          {conversation.DisplayName || 'Hội thoại'}
        </span>
        {conversation.IsGroup && (
          <button
            onClick={() => setShowMembers(true)}
            title="Thành viên nhóm"
            aria-label="Thành viên nhóm"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <IconSettings size={17} />
          </button>
        )}
      </div>

      {showMembers && (
        <GroupMembersModal
          conversationId={conversationId}
          currentUserId={currentUserId}
          isAdmin={!!conversation.MyIsAdmin}
          onClose={() => setShowMembers(false)}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <LoadingState label="Đang tải tin nhắn..." padding={20} />
        ) : messages.map(m => {
          const mine = m.SenderID === currentUserId;
          return (
            <div key={m.MessageID} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && conversation.IsGroup && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{m.SenderName}</span>
              )}
              <div style={{
                maxWidth: '72%', padding: '9px 13px',
                borderRadius: mine ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
                background: mine ? 'var(--accent)' : 'var(--surface)',
                color: mine ? 'var(--accent-fg)' : 'var(--text)',
                border: mine ? 'none' : '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {m.Content && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.Content}</div>}
                {(m.Attachments || []).map(att => <AttachmentView key={att.AttachmentID} att={att} mine={mine} />)}
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                {new Date(m.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        {typingUser && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Đang nhập...</div>}
        <div ref={bottomRef} />
      </div>

      <MessageComposer onSend={handleSend} onTyping={handleTypingChange} disabled={loading} />
    </div>
  );
};

export default MessageThread;
