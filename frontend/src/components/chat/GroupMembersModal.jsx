import React, { useEffect, useState } from 'react';
import { getMembers, addMember, removeMember, getBasicUsers } from '../../services/chatService';
import { IconX, IconTrash } from '../icons';

const GroupMembersModal = ({ conversationId, currentUserId, isAdmin, onClose }) => {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [addingId, setAddingId] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    getMembers(conversationId).then(res => setMembers(res.data || [])).catch(() => {});
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      getBasicUsers().then(res => setAllUsers(res.data || [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const availableUsers = allUsers.filter(u => !members.some(m => m.UserID === u.UserID));

  const handleAdd = async () => {
    if (!addingId) return;
    setError('');
    try {
      await addMember(conversationId, Number(addingId));
      setAddingId('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thêm được thành viên!');
    }
  };

  const handleRemove = async (userId) => {
    setError('');
    try {
      await removeMember(conversationId, userId);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Không xóa được thành viên!');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 16, boxShadow: 'var(--shadow-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Thành viên nhóm</strong>
          <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><IconX size={18} /></button>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={addingId} onChange={(e) => setAddingId(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}>
              <option value="">— Thêm thành viên —</option>
              {availableUsers.map(u => <option key={u.UserID} value={u.UserID}>{u.FullName}</option>)}
            </select>
            <button onClick={handleAdd} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 14px', cursor: 'pointer', fontWeight: 600 }}>Thêm</button>
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {members.map(m => (
            <div key={m.UserID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
              <span>
                {m.FullName} {m.IsAdmin && <span style={{ fontSize: 11, color: 'var(--accent)' }}>(quản trị)</span>}
              </span>
              {isAdmin && m.UserID !== currentUserId && (
                <button onClick={() => handleRemove(m.UserID)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><IconTrash size={12} />Xóa</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupMembersModal;
