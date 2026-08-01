import React from 'react';
import { IconAlertTriangle, IconX } from '../icons';

// Banner cảnh báo dữ liệu nhạy cảm (module 3) — hiện sau khi scanSensitive() phát hiện
// PII hoặc từ ngữ vi phạm quy chế. Không chặn cứng: chỉ cảnh báo, người dùng tự quyết
// định gửi tiếp hay quay lại sửa (AI có thể sai, không nên khóa hoàn toàn việc xuất bản).
const SensitiveDataWarning = ({ piiMatches, wordingWarnings, onConfirmSend, onCancel }) => {
  const hasPii = piiMatches?.length > 0;
  const hasWording = wordingWarnings?.length > 0;
  if (!hasPii && !hasWording) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 22, maxWidth: 480, width: '100%', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          <IconAlertTriangle size={18} />Phát hiện dữ liệu nhạy cảm
        </div>

        {hasPii && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Thông tin cá nhân nhạy cảm:</div>
            {piiMatches.map((m, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{m.label}:</strong> {m.values.join(', ')}
              </div>
            ))}
          </div>
        )}

        {hasWording && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Từ ngữ có thể chưa đúng chuẩn mực:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {wordingWarnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onCancel}
            style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconX size={14} />Quay lại chỉnh sửa
          </button>
          <button type="button" onClick={onConfirmSend}
            style={{ flex: 1, padding: '10px 14px', border: 'none', background: 'var(--danger)', color: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700 }}>
            Vẫn gửi bài
          </button>
        </div>
      </div>
    </div>
  );
};

export default SensitiveDataWarning;
