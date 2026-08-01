import React, { useEffect, useRef, useState } from 'react';
import { getAiHealth, askRag } from '../services/aiService';
import { IconRobot, IconSend, IconLoader } from './icons';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

const PANEL_WIDTH = 340;

// Icon nổi mở panel hỏi-đáp RAG (module 4 - tra cứu văn bản quy định nội bộ). Chấm
// trạng thái xanh/xám lấy từ /ai/health — cho biết AI local (Ollama) có đang kết nối
// được không, để người dùng không bối rối khi bấm hỏi mà không có phản hồi.
const AIBell = () => {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'ai', text, sources?}
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const pos = useDropdownPosition(open, buttonRef, PANEL_WIDTH);

  useEffect(() => {
    getAiHealth().then(r => setConnected(!!r.data.connected)).catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAsk = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setAsking(true);
    try {
      const { data } = await askRag(q);
      setMessages(prev => [...prev, { role: 'ai', text: data.answer, sources: data.sources }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: err.response?.data?.error || 'Có lỗi khi hỏi AI, thử lại sau.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(prev => !prev)}
        title="Trợ lý tra cứu AI"
        aria-label="Trợ lý tra cứu AI"
        style={{
          width: 34, height: 34, borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.06)', border: '1px solid var(--sidebar-border)',
          color: 'var(--sidebar-fg)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
        }}
      >
        <IconRobot size={16} />
        <span title={connected ? 'AI local: đã kết nối' : 'AI local: chưa kết nối'} style={{
          position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%',
          background: connected ? 'var(--success)' : 'var(--text-muted)', border: '1.5px solid var(--sidebar-bg, #1a1a1a)'
        }} />
      </button>

      {open && pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 500,
          width: PANEL_WIDTH, maxWidth: 'calc(100vw - 16px)', height: 420,
          background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column', padding: 12
        }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 14 }}>Trợ lý tra cứu quy định (AI)</strong>
            <span style={{ fontSize: 11, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
              {connected ? '● Đã kết nối' : '● Chưa kết nối'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Hỏi về quy chế biên tập, luật báo chí... đã nạp trong kho tri thức. Ví dụ: "Bài viết có được nêu tên nạn nhân vụ án không?"
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%', fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                color: m.role === 'user' ? 'var(--accent-fg)' : 'var(--text)',
                whiteSpace: 'pre-wrap'
              }}>
                {m.text}
                {m.sources?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10.5, opacity: 0.75 }}>
                    Nguồn: {[...new Set(m.sources.map(s => s.title))].join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAsk} style={{ display: 'flex', gap: 6 }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Nhập câu hỏi..."
              disabled={asking}
              style={{ flex: 1, padding: '7px 9px', fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)' }}
            />
            <button type="submit" disabled={asking || !question.trim()} style={{ padding: '0 10px', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {asking ? <IconLoader size={14} /> : <IconSend size={14} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIBell;
