import React from 'react';
import { IconPlus } from '../icons';

const ConversationList = ({ conversations, selectedId, onSelect, onNewChat }) => {
  return (
    <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14.5 }}>Hội thoại</strong>
        <button
          onClick={onNewChat}
          title="Tin nhắn mới"
          aria-label="Tin nhắn mới"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconPlus size={15} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {conversations.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Chưa có hội thoại nào</div>
        ) : conversations.map(c => (
          <div
            key={c.ConversationID}
            className="hoverable-row"
            onClick={() => onSelect(c.ConversationID)}
            style={{
              padding: '12px 14px', cursor: 'pointer',
              background: c.ConversationID === selectedId ? 'var(--accent-soft)' : undefined,
              borderBottom: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 3
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: c.UnreadCount > 0 ? 700 : 500, fontSize: 13.5, display: 'flex', alignItems: 'center' }}>
                {!c.IsGroup && (
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 7,
                    background: c.OtherMemberOnline ? 'var(--success)' : 'var(--text-muted)'
                  }} />
                )}
                {c.DisplayName || 'Hội thoại'}
              </span>
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.LastMessage || '(chưa có tin nhắn)'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationList;
