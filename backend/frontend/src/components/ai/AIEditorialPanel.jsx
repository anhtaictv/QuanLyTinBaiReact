import React, { useState } from 'react';
import { proofreadText, suggestHeadlines, summarizeContent } from '../../services/aiService';
import { IconSparkles, IconLoader, IconCheck, IconX } from '../icons';

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600
};

// Trợ lý biên tập AI: sửa lỗi/chuẩn hóa văn phong, gợi ý tiêu đề, tóm tắt sapo.
// Chạy trên "noiDung" (nội dung tóm tắt) — trường text duy nhất backend có sẵn để đọc,
// file .docx đính kèm không được AI đọc trực tiếp ở bản này.
const AIEditorialPanel = ({ content, onApplyContent, onApplyTitle, onApplySapo }) => {
  const [loadingAction, setLoadingAction] = useState(null);
  const [result, setResult] = useState(null); // { type: 'proofread'|'headlines'|'sapo', data }
  const [errorMsg, setErrorMsg] = useState('');

  const run = async (type, fn) => {
    if (!content || !content.trim()) {
      setErrorMsg('Nhập nội dung tóm tắt trước đã nhé.');
      return;
    }
    setErrorMsg('');
    setLoadingAction(type);
    setResult(null);
    try {
      const data = await fn();
      setResult({ type, data });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div style={{ marginBottom: 16, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
        <IconSparkles size={14} />TRỢ LÝ BIÊN TẬP AI
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={btnStyle} disabled={!!loadingAction}
          onClick={() => run('proofread', () => proofreadText(content).then(r => r.data.result))}>
          {loadingAction === 'proofread' ? <IconLoader size={13} /> : null}Sửa lỗi & chuẩn hóa văn phong
        </button>
        <button type="button" style={btnStyle} disabled={!!loadingAction}
          onClick={() => run('headlines', () => suggestHeadlines(content).then(r => r.data.headlines))}>
          {loadingAction === 'headlines' ? <IconLoader size={13} /> : null}Gợi ý tiêu đề
        </button>
        <button type="button" style={btnStyle} disabled={!!loadingAction}
          onClick={() => run('sapo', () => summarizeContent(content).then(r => r.data.sapo))}>
          {loadingAction === 'sapo' ? <IconLoader size={13} /> : null}Tóm tắt sapo
        </button>
      </div>

      {errorMsg && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      {result?.type === 'proofread' && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{result.data}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...btnStyle, background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none' }}
              onClick={() => { onApplyContent(result.data); setResult(null); }}><IconCheck size={13} />Áp dụng</button>
            <button type="button" style={btnStyle} onClick={() => setResult(null)}><IconX size={13} />Bỏ qua</button>
          </div>
        </div>
      )}

      {result?.type === 'sapo' && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{result.data}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...btnStyle, background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none' }}
              onClick={() => { onApplySapo(result.data); setResult(null); }}><IconCheck size={13} />Áp dụng vào Sapo</button>
            <button type="button" style={btnStyle} onClick={() => setResult(null)}><IconX size={13} />Bỏ qua</button>
          </div>
        </div>
      )}

      {result?.type === 'headlines' && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Bấm để áp dụng vào Tiêu đề:</div>
          {(result.data || []).map((h, i) => (
            <div key={i} className="hoverable-row"
              onClick={() => { onApplyTitle(h); setResult(null); }}
              style={{ padding: '7px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 'var(--radius-sm)', borderBottom: i < result.data.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIEditorialPanel;
