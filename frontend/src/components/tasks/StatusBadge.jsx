import React from 'react';
import { STATUS_COLORS, statusLabel } from '../../utils/taskStatus';

// Nhãn trạng thái dùng chung cho lịch, danh sách việc của tôi và bảng việc đã giao —
// để ba chỗ không bao giờ tô màu lệch nhau cho cùng một trạng thái.
const StatusBadge = ({ status, overdue = false, size = 12 }) => {
  const color = STATUS_COLORS[status] || STATUS_COLORS.pending;

  // Quá hạn đè lên màu trạng thái: việc trễ là thứ cần đập vào mắt trước tiên.
  const fg = overdue ? 'var(--danger)' : color.fg;
  const bg = overdue ? 'var(--danger-soft)' : color.bg;

  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: size, fontWeight: 600, color: fg, background: bg, whiteSpace: 'nowrap'
    }}>
      {overdue ? `${statusLabel(status)} · trễ hạn` : statusLabel(status)}
    </span>
  );
};

export default StatusBadge;
