import React, { useState, useRef, useEffect } from 'react';
import { askAssistant } from '../../services/aiService';
import { IconRobot, IconSend, IconLoader, IconAlertCircle, IconX } from '../icons';

const SLOW_HINT_MS = 12000;

// Chat "ghim theo bài viết" — không ghim theo đoạn văn cụ thể (Google Docs iframe là app
// bên thứ 3, không bôi đen/chat trực tiếp trong đó được). Ngữ cảnh bài viết được nhét vào
// TURN USER đầu tiên (không phải system) vì aiConversation.js chặn client gửi role
// 'system' — xem backend/backend/utils/aiConversation.js.
//
// pos: {top, left} tính sẵn bởi useDropdownPosition ở nơi gọi (neo dưới nút bấm, tự kẹp
// trong viewport) — cùng cơ chế định vị với AIBell/ChatBell/ErrorBell, để panel AI nào
// cũng hoạt động giống nhau thay vì mỗi nơi tự bịa một kiểu nổi khác nhau.
const ArticleChatPopover = ({ title, content, onClose, pos }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    // Lượt đầu tiên: nhét ngữ cảnh bài viết vào câu hỏi. Các lượt sau chỉ hỏi bình thường —
    // ngữ cảnh đã nằm trong lịch sử hội thoại rồi, nhét lại mỗi lượt sẽ làm loãng prompt.
    const questionWithContext = messages.length === 0
      ? `Bài viết đang xem: "${title}"\n\n${content}\n\n---\nCâu hỏi: ${question}`
      : question;

    const conversation = [...messages, { role: 'user', content: questionWithContext }];
    setMessages([...messages, { role: 'user', content: question }]); // hiển thị câu hỏi gọn, không lộ ngữ cảnh nhét kèm
    setInput('');
    setError('');
    setLoading(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS);

    try {
      const { data } = await askAssistant(conversation);
      setMessages([...conversation, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi được câu hỏi. Kiểm tra kết nối rồi thử lại.');
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!pos) return null;

  return (
    <div style={{
      position: 'fixed', top: pos.top, left: pos.left, width: 340, maxWidth: 'calc(100vw - 16px)', maxHeight: '70vh', zIndex: 500,
      display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          <IconRobot size={15} />Hỏi AI về bài viết
        </span>
        <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--sidebar-fg)', cursor: 'pointer', display: 'flex' }}><IconX size={15} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 160 }}>
        {messages.length === 0 && !loading && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Hỏi bất cứ điều gì về bài viết này — ví dụ "Bài này còn thiếu góc nhìn nào?".
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '85%', padding: '8px 11px', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
              color: m.role === 'user' ? 'var(--accent-fg)' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)'
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12.5 }}>
            <IconLoader size={14} />{slow ? 'Vẫn đang soạn câu trả lời…' : 'Đang suy nghĩ…'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          <IconAlertCircle size={13} />{error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Nhập câu hỏi…"
          style={{ flex: 1, resize: 'none', fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Gửi câu hỏi"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0,
            borderRadius: 'var(--radius-sm)', border: 'none',
            background: loading || !input.trim() ? 'var(--surface-2)' : 'var(--accent)',
            color: loading || !input.trim() ? 'var(--text-muted)' : 'var(--accent-fg)',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? <IconLoader size={15} /> : <IconSend size={15} />}
        </button>
      </div>
    </div>
  );
};

export default ArticleChatPopover;
