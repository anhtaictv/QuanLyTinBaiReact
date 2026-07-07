import React, { useEffect, useRef, useState } from 'react';
import { getMessages, uploadChatFile, editMessage, recallMessage, deleteMessageForMe } from '../../services/chatService';
import MessageComposer from './MessageComposer';
import GroupMembersModal from './GroupMembersModal';
import { IconSettings, IconFileText, IconMoreVertical } from '../icons';
import { showToastError } from '../../utils/Toast';
import LoadingState from '../LoadingState';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Giới hạn số tin nhắn giữ trong bộ nhớ trình duyệt khi hội thoại mở lâu và liên tục
// nhận tin nhắn mới qua socket — cắt bớt phần cũ nhất, có thể tải lại qua phân trang.
const MAX_MESSAGES_IN_MEMORY = 300;
const TRIM_TARGET = 150;

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

const MessageActionsMenu = ({ mine, recalled, onEdit, onRecall, onDeleteForMe, open, onToggle, align }) => (
  <div className="chat-msg-actions-wrap" style={{ position: 'relative' }}>
    <button
      onClick={onToggle}
      title="Tuỳ chọn"
      aria-label="Tuỳ chọn"
      className={`chat-msg-actions${open ? ' force-visible' : ''}`}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%',
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-muted)'
      }}
    >
      <IconMoreVertical size={14} />
    </button>
    {open && (
      <div style={{
        position: 'absolute', top: 26, [align]: 0, zIndex: 20, minWidth: 170,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-md)', overflow: 'hidden'
      }}>
        {mine && !recalled && (
          <button onClick={onEdit} style={menuItemStyle}>Chỉnh sửa</button>
        )}
        {mine && !recalled && (
          <button onClick={onRecall} style={menuItemStyle}>Thu hồi</button>
        )}
        <button onClick={onDeleteForMe} style={{ ...menuItemStyle, color: 'var(--danger)' }}>Xoá chỉ ở phía tôi</button>
      </div>
    )}
  </div>
);

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)'
};

const MessageThread = ({ conversation, currentUserId, socket }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const pendingScrollAdjustRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const conversationId = conversation.ConversationID;

  const markRead = (lastMessageId) => {
    if (lastMessageId) socket.emit('message:read', { conversationId, lastMessageId });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHasMore(true);
    getMessages(conversationId).then(res => {
      if (cancelled) return;
      const list = res.data || [];
      setMessages(list);
      setHasMore(list.length >= 50);
      setLoading(false);
      const last = list[list.length - 1];
      if (last) markRead(last.MessageID);
    }).catch(() => setLoading(false));

    socket.emit('conversation:join', { conversationId });

    return () => {
      cancelled = true;
      socket.emit('conversation:leave', { conversationId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const loadOlder = () => {
    // Chặn bằng ref (đồng bộ) thay vì state — nhiều sự kiện scroll dồn dập trước khi
    // React re-render vẫn thấy state cũ và có thể cùng lọt qua, gây tải trùng.
    if (loadingMoreRef.current || !hasMore || messages.length === 0) return;
    loadingMoreRef.current = true;
    const oldest = messages[0].MessageID;
    getMessages(conversationId, oldest).then(res => {
      const older = res.data || [];
      if (!older.length) {
        setHasMore(false);
        return;
      }
      if (containerRef.current) {
        pendingScrollAdjustRef.current = {
          container: containerRef.current,
          prevScrollHeight: containerRef.current.scrollHeight
        };
      }
      setMessages(prev => [...older, ...prev]);
      if (older.length < 50) setHasMore(false);
    }).catch(() => {}).finally(() => { loadingMoreRef.current = false; });
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (el && el.scrollTop < 40) loadOlder();
  };

  useEffect(() => {
    const upsert = (message) => {
      if (message.ConversationID !== conversationId) return;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.MessageID === message.MessageID);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = message;
          return next;
        }
        const next = [...prev, message];
        // Chỉ cắt bớt khi người dùng đang ở gần cuối khung chat — nếu họ đang cuộn lên
        // đọc lịch sử cũ, cắt ngay lúc này sẽ làm mất nội dung đang xem trước mắt họ.
        if (next.length > MAX_MESSAGES_IN_MEMORY) {
          const el = containerRef.current;
          const nearBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 200);
          if (nearBottom) {
            setHasMore(true);
            return next.slice(next.length - TRIM_TARGET);
          }
        }
        return next;
      });
    };

    // Sửa/thu hồi chỉ CẬP NHẬT tin nhắn đã có sẵn trong state, không bao giờ thêm mới —
    // nếu không tìm thấy (đã bị cắt khỏi bộ nhớ, chưa tải, hoặc người dùng đã "xoá chỉ
    // ở phía tôi"), bỏ qua thay vì nối vào cuối danh sách (tránh hồi sinh tin nhắn đã xoá
    // hoặc hiển thị sai thứ tự thời gian).
    const replaceIfPresent = (message) => {
      if (message.ConversationID !== conversationId) return;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.MessageID === message.MessageID);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = message;
        return next;
      });
    };

    const handleNewMessage = (message) => {
      upsert(message);
      if (message.ConversationID === conversationId && message.SenderID !== currentUserId) markRead(message.MessageID);
    };

    const handleEditedOrRecalled = (message) => replaceIfPresent(message);

    const handleDeletedForMe = ({ messageId, conversationId: cid }) => {
      if (cid !== conversationId) return;
      setMessages(prev => prev.filter(m => m.MessageID !== messageId));
    };

    const handleTyping = ({ conversationId: cid, userId, isTyping }) => {
      if (cid !== conversationId || userId === currentUserId) return;
      setTypingUser(isTyping ? userId : null);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleEditedOrRecalled);
    socket.on('message:recalled', handleEditedOrRecalled);
    socket.on('message:deletedForMe', handleDeletedForMe);
    socket.on('typing:update', handleTyping);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEditedOrRecalled);
      socket.off('message:recalled', handleEditedOrRecalled);
      socket.off('message:deletedForMe', handleDeletedForMe);
      socket.off('typing:update', handleTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, socket, currentUserId]);

  useEffect(() => {
    // Phải nằm trong CÙNG 1 effect: tách thành 2 effect [messages] riêng biệt khiến effect
    // sau luôn thấy ref đã bị effect trước xoá, nên luôn cuộn xuống đáy dù vừa tải tin cũ.
    const adj = pendingScrollAdjustRef.current;
    if (adj) {
      adj.container.scrollTop = adj.container.scrollHeight - adj.prevScrollHeight;
      pendingScrollAdjustRef.current = null;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (openMenuId == null) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.chat-msg-actions-wrap')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

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

  const startEdit = (m) => {
    setOpenMenuId(null);
    setEditingId(m.MessageID);
    setEditValue(m.Content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (messageId) => {
    const content = editValue.trim();
    if (!content) return;
    try {
      await editMessage(messageId, content);
      cancelEdit();
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không thể sửa tin nhắn!');
    }
  };

  const handleRecall = async (m) => {
    setOpenMenuId(null);
    if (!window.confirm('Thu hồi tin nhắn này với mọi người?')) return;
    try {
      await recallMessage(m.MessageID);
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không thể thu hồi tin nhắn!');
    }
  };

  const handleDeleteForMe = async (m) => {
    setOpenMenuId(null);
    if (!window.confirm('Xoá tin nhắn này chỉ ở phía bạn? Người khác vẫn thấy bình thường.')) return;
    try {
      await deleteMessageForMe(m.MessageID);
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không thể xoá tin nhắn!');
    }
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

      <div ref={containerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <LoadingState label="Đang tải tin nhắn..." padding={20} />
        ) : messages.map(m => {
          const mine = m.SenderID === currentUserId;
          const isEditing = editingId === m.MessageID;
          return (
            <div key={m.MessageID} className="chat-msg-row" style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && conversation.IsGroup && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{m.SenderName}</span>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexDirection: mine ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                <div style={{
                  maxWidth: '100%', padding: '9px 13px',
                  borderRadius: mine ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
                  background: mine ? 'var(--accent)' : 'var(--surface)',
                  color: mine ? 'var(--accent-fg)' : 'var(--text)',
                  border: mine ? 'none' : '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {m.IsRecalled ? (
                    <div style={{ fontSize: 13.5, fontStyle: 'italic', opacity: 0.75 }}>Tin nhắn đã được thu hồi</div>
                  ) : isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(m.MessageID); }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        rows={2}
                        style={{
                          resize: 'vertical', fontSize: 13.5, padding: 6, borderRadius: 6,
                          border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--bg)'
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={cancelEdit} style={{ ...menuItemStyle, width: 'auto', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>Huỷ</button>
                        <button onClick={() => saveEdit(m.MessageID)} style={{ ...menuItemStyle, width: 'auto', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 600 }}>Lưu</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.Content && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.Content}</div>}
                      {(m.Attachments || []).map(att => <AttachmentView key={att.AttachmentID} att={att} mine={mine} />)}
                    </>
                  )}
                </div>

                {!isEditing && (
                  <MessageActionsMenu
                    mine={mine}
                    recalled={!!m.IsRecalled}
                    align={mine ? 'right' : 'left'}
                    open={openMenuId === m.MessageID}
                    onToggle={() => setOpenMenuId(prev => prev === m.MessageID ? null : m.MessageID)}
                    onEdit={() => startEdit(m)}
                    onRecall={() => handleRecall(m)}
                    onDeleteForMe={() => handleDeleteForMe(m)}
                  />
                )}
              </div>

              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                {new Date(m.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                {m.IsEdited && !m.IsRecalled && ' · đã chỉnh sửa'}
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
