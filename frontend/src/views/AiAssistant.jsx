import React, { useState, useRef, useEffect } from 'react';
import { askAssistant, getAiHealth } from '../services/aiService';
import { IconSend, IconLoader, IconTrash, IconAlertCircle, IconRefresh } from '../components/icons';

// Ollama chạy trên máy khác qua Tailscale, sinh khoảng 11 token/giây nên câu trả lời dài
// mất hàng chục giây. Báo trước cho người dùng sau mốc này để họ không tưởng bị treo.
const SLOW_HINT_MS = 12000;

const SUGGESTIONS = [
  'Tóm tắt giúp tôi Luật Báo chí 2016 có những điểm chính nào?',
  'Gợi ý 5 góc tiếp cận cho bài viết về cà phê Đắk Lắk',
  'Giải thích ngắn gọn sự khác nhau giữa tin và phóng sự',
  'Cách viết một đoạn sapo hấp dẫn?'
];

const AiAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(null); // null = đang kiểm tra

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getAiHealth()
      .then(d => { if (alive) setConnected(!!d.connected); })
      .catch(() => { if (alive) setConnected(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Nhận vào hội thoại ĐÃ kết thúc bằng câu hỏi của người dùng, chỉ nối thêm câu trả lời.
  // Tách riêng để nút "Thử lại" dùng lại được mà không nhân đôi câu hỏi đã gửi hụt.
  const send = async (conversation) => {
    setError('');
    setLoading(true);
    setSlow(false);

    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS);

    try {
      const reply = await askAssistant(conversation);
      setMessages([...conversation, { role: 'assistant', content: reply }]);
      setConnected(true);
    } catch (err) {
      // 503 = gateway chưa sẵn sàng hoặc sai cấu hình; backend đã trả câu tiếng Việt rõ nghĩa.
      const serverMsg = err.response?.data?.error;
      setError(serverMsg || 'Không gửi được câu hỏi. Kiểm tra kết nối rồi thử lại.');
      if (err.response?.status === 503) setConnected(false);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const conversation = [...messages, { role: 'user', content: question }];
    setMessages(conversation);
    setInput('');
    send(conversation);
  };

  // Hội thoại hiện tại đã kết thúc bằng câu hỏi gửi hụt nên gửi lại nguyên trạng.
  const handleRetry = () => {
    if (loading || messages.length === 0) return;
    if (messages[messages.length - 1].role !== 'user') return;
    send(messages);
  };

  const handleKeyDown = (e) => {
    // Enter gửi, Shift+Enter xuống dòng — giống thói quen ở màn hình Tin nhắn.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  };

  const statusChip = () => {
    if (connected === null) return { text: 'Đang kiểm tra…', color: 'var(--text-muted)', bg: 'var(--surface-2)' };
    if (connected) return { text: 'Trợ lý sẵn sàng', color: 'var(--success)', bg: 'var(--success-soft)' };
    return { text: 'Trợ lý chưa sẵn sàng', color: 'var(--warning)', bg: 'var(--warning-soft)' };
  };
  const chip = statusChip();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 420 }}>
      {/* Tiêu đề + trạng thái */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', marginBottom: 16
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Trợ lý AI
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Hỏi bất cứ điều gì — không giới hạn ở nghiệp vụ báo chí. Trợ lý luôn trả lời bằng tiếng Việt.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999,
            color: chip.color, background: chip.bg
          }}>
            {chip.text}
          </span>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Xoá hội thoại và bắt đầu lại"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)'
              }}
            >
              <IconTrash size={14} />Hội thoại mới
            </button>
          )}
        </div>
      </header>

      {/* Khung hội thoại */}
      <div
        aria-live="polite"
        style={{
          flex: 1, overflowY: 'auto', padding: 18,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)'
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ maxWidth: 560, margin: '28px auto', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18 }}>
              Chưa có câu hỏi nào. Thử một trong các gợi ý sau:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="ai-suggestion"
                  style={{
                    textAlign: 'left', fontSize: 13.5, lineHeight: 1.5, cursor: 'pointer',
                    padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 14
            }}
          >
            <div style={{
              maxWidth: '78%', padding: '11px 15px', borderRadius: 'var(--radius-md)',
              fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
              color: m.role === 'user' ? 'var(--accent-fg)' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)'
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)', fontSize: 13.5 }}>
            <IconLoader size={16} />
            {slow ? 'Vẫn đang soạn câu trả lời — câu hỏi dài có thể mất tới một phút…' : 'Trợ lý đang suy nghĩ…'}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, marginTop: 12,
          padding: '10px 14px', fontSize: 13.5,
          background: 'var(--danger-soft)', color: 'var(--danger)',
          border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)'
        }}>
          <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={handleRetry}
            disabled={loading || messages.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
              padding: '5px 11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)'
            }}
          >
            <IconRefresh size={13} />Thử lại
          </button>
        </div>
      )}

      {/* Ô nhập */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12,
        padding: 12, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)'
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Nhập câu hỏi… (Enter để gửi, Shift+Enter để xuống dòng)"
          aria-label="Câu hỏi gửi trợ lý AI"
          style={{
            flex: 1, resize: 'none', fontSize: 14, lineHeight: 1.6, fontFamily: 'var(--font-body)',
            padding: '9px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)'
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Gửi câu hỏi"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            padding: '11px 18px', borderRadius: 'var(--radius-sm)', border: 'none',
            fontSize: 13.5, fontWeight: 600,
            background: loading || !input.trim() ? 'var(--surface-2)' : 'var(--accent)',
            color: loading || !input.trim() ? 'var(--text-muted)' : 'var(--accent-fg)',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? <IconLoader size={16} /> : <IconSend size={16} />}
          Gửi
        </button>
      </div>
    </div>
  );
};

export default AiAssistant;
