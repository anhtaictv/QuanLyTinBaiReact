import React, { useEffect, useState } from 'react';
import { getBasicUsers, createConversation } from '../../services/chatService';
import { IconX, IconAlertCircle } from '../icons';

const GROUP_CREATOR_ROLES = ['admin', 'trưởng ban', 'thư ký'];

const NewChatModal = ({ currentUserId, currentUserRole, onClose, onCreated }) => {
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState('single'); // 'single' | 'group'
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canCreateGroup = GROUP_CREATOR_ROLES.includes((currentUserRole || '').toLowerCase());

  useEffect(() => {
    getBasicUsers().then(res => {
      setUsers((res.data || []).filter(u => u.UserID !== currentUserId));
    }).catch(() => setUsers([]));
  }, [currentUserId]);

  const toggleSelect = (userId) => {
    if (mode === 'single') {
      setSelectedIds([userId]);
    } else {
      setSelectedIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    }
  };

  const handleCreate = async () => {
    if (!selectedIds.length) {
      setError('Chọn ít nhất 1 người!');
      return;
    }
    if (mode === 'group' && !title.trim()) {
      setError('Nhập tên nhóm!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await createConversation(selectedIds, mode === 'group', title.trim());
      onCreated(res.data.conversationId);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tạo được hội thoại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 16, boxShadow: 'var(--shadow-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Tin nhắn mới</strong>
          <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><IconX size={18} /></button>
        </div>

        {canCreateGroup && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => { setMode('single'); setSelectedIds([]); }}
              style={{ flex: 1, padding: 8, borderRadius: 'var(--radius-sm)', border: mode === 'single' ? '2px solid var(--accent)' : '1px solid var(--border)', background: mode === 'single' ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
            >
              1-1
            </button>
            <button
              onClick={() => { setMode('group'); setSelectedIds([]); }}
              style={{ flex: 1, padding: 8, borderRadius: 'var(--radius-sm)', border: mode === 'group' ? '2px solid var(--accent)' : '1px solid var(--border)', background: mode === 'group' ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
            >
              Tạo nhóm
            </button>
          </div>
        )}

        {mode === 'group' && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên nhóm..."
            style={{ padding: 9, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', marginBottom: 12 }}
          />
        )}

        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          {users.map(u => (
            <div
              key={u.UserID}
              className="hoverable-row"
              onClick={() => toggleSelect(u.UserID)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: selectedIds.includes(u.UserID) ? 'var(--accent-soft)' : undefined,
                borderBottom: '1px solid var(--border)'
              }}
            >
              {u.FullName}
            </div>
          ))}
        </div>

        {error && <div style={{ display: 'flex', gap: 6, color: 'var(--danger)', fontSize: 13, marginTop: 8 }}><IconAlertCircle size={14} style={{ marginTop: 1 }} />{error}</div>}

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{ marginTop: 12, padding: 10, background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700 }}
        >
          {loading ? 'Đang tạo...' : 'Bắt đầu chat'}
        </button>
      </div>
    </div>
  );
};

export default NewChatModal;
