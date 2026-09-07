import React from 'react';
import { diffWords } from 'diff';

// So sánh trực quan kiểu GitHub: gạch bỏ chữ bị xóa, tô đậm chữ mới thêm. CHỈ so sánh
// bản gốc CTV gửi với bản đang sửa trong phiên Google Docs hiện tại — không phải lịch sử
// đa phiên bản (file Drive bị xóa ngay sau khi hoàn tất duyệt, xem driveRoutes.js /complete).
const VisualDiff = ({ originalText, currentText }) => {
  const parts = diffWords(originalText || '', currentText || '');

  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => (
        <span
          key={i}
          style={
            part.added
              ? { background: 'var(--success-soft)', color: 'var(--success)', textDecoration: 'none' }
              : part.removed
              ? { background: 'var(--danger-soft)', color: 'var(--danger)', textDecoration: 'line-through' }
              : { color: 'var(--text)' }
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
};

export default VisualDiff;
