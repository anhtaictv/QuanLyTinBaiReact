import React, { useState } from 'react';
import { factCheckContent, checkConsistency } from '../../services/aiService';
import { IconShield, IconLoader, IconAlertCircle, IconCheckCircle } from '../icons';

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600
};

const SEVERITY_STYLE = {
  cao:    { fg: 'var(--danger)',  bg: 'var(--danger-soft)' },
  trung:  { fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  thap:   { fg: 'var(--text-muted)', bg: 'var(--surface-2)' }
};

// Model có thể trả "Cao", "CAO", "trung bình" thiếu dấu... — so khớp so sánh khớp chính
// xác chuỗi tiếng Việt có dấu là quá mong manh, dễ âm thầm mất cảnh báo đỏ khi model lệch
// 1 ký tự. Bỏ dấu + hạ chữ thường rồi chỉ cần chứa từ khóa "cao"/"trung" là đủ nhận diện.
function severityStyle(raw) {
  const norm = (raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (norm.includes('cao')) return SEVERITY_STYLE.cao;
  if (norm.includes('trung')) return SEVERITY_STYLE.trung;
  return SEVERITY_STYLE.thap;
}

// AI giám sát chất lượng: Fact-Check (đối chiếu số liệu/nhận định với bài đã duyệt) và
// Consistency Checker (đối chiếu văn phong/thuật ngữ với cẩm nang tòa soạn) — cùng dùng
// kho tri thức RAG sẵn có (Module 4), chỉ khác corpus. Chạy trên "content" (nội dung tóm
// tắt), giống AIEditorialPanel — file .docx đính kèm không được AI đọc trực tiếp ở bản này.
const RagChecksPanel = ({ content }) => {
  const [loadingAction, setLoadingAction] = useState(null);
  const [result, setResult] = useState(null); // { type: 'factcheck'|'consistency', issues, sources }
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
      const { data } = await fn();
      setResult({ type, issues: data.issues || [], sources: data.sources || [] });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div style={{ marginBottom: 16, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
        <IconShield size={14} />AI GIÁM SÁT CHẤT LƯỢNG
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={btnStyle} disabled={!!loadingAction}
          onClick={() => run('factcheck', () => factCheckContent(content))}>
          {loadingAction === 'factcheck' ? <IconLoader size={13} /> : null}Kiểm chứng nội dung
        </button>
        <button type="button" style={btnStyle} disabled={!!loadingAction}
          onClick={() => run('consistency', () => checkConsistency(content))}>
          {loadingAction === 'consistency' ? <IconLoader size={13} /> : null}Kiểm tra nhất quán
        </button>
      </div>

      {errorMsg && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      {result && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
          {result.issues.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <IconCheckCircle size={14} />Không phát hiện vấn đề gì.
            </div>
          ) : (
            result.issues.map((it, i) => {
              const sev = severityStyle(it.severity);
              return (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < result.issues.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: sev.fg, background: sev.bg, textTransform: 'uppercase' }}>
                      {it.severity || 'thấp'}
                    </span>
                    <strong style={{ fontSize: 13 }}>{it.claim || it.phrase}</strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: it.suggestion ? 4 : 0 }}>{it.issue}</div>
                  {it.suggestion && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <IconAlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />Gợi ý: {it.suggestion}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {result.sources.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
              Đối chiếu với {result.sources.length} đoạn tham khảo: {result.sources.map(s => s.title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RagChecksPanel;
