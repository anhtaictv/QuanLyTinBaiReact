import React, { useRef, useState } from 'react';
import { IconPaperclip, IconSend, IconX } from '../icons';

const MessageComposer = ({ onSend, onTyping, disabled }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 1500);
  };

  const handleFilePick = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
    onTyping(false);
    clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 10, background: 'var(--surface)' }}>
      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {files.map((f, idx) => (
            <div key={idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconPaperclip size={12} />{f.name}
              <button onClick={() => removeFile(idx)} aria-label="Bỏ file đính kèm" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><IconX size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Đính kèm ảnh/file"
          aria-label="Đính kèm ảnh/file"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <IconPaperclip size={17} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
          style={{ display: 'none' }}
          onChange={handleFilePick}
        />
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Nhập tin nhắn..."
          rows={1}
          style={{ flex: 1, resize: 'none', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14 }}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          aria-label="Gửi tin nhắn"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--radius-sm)', width: 42, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <IconSend size={16} />
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
