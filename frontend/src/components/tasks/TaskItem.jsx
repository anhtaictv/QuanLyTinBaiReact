import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { TASK_STATUSES, STATUS_LABELS, isOverdue } from '../../utils/taskStatus';
import { formatDateTime } from '../../utils/taskDates';
import { IconEdit, IconTrash, IconFileText } from '../icons';

const iconBtn = (color) => ({
  display: 'flex', padding: 7, cursor: 'pointer', color,
  border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)'
});

// Một dòng công việc, dùng chung cho "Việc của tôi" và "Việc tôi đã giao".
// onChangeStatus có thì hiện ô chọn tiến độ; onEdit/onDelete có thì hiện nút quản lý —
// nhờ vậy hai màn hình chỉ khác nhau ở việc truyền hàm nào vào, không nhân đôi giao diện.
const TaskItem = ({ task, onChangeStatus, onEdit, onDelete, busy = false }) => {
  const overdue = isOverdue(task);

  return (
    <div style={{
      border: '1px solid var(--border)', background: 'var(--surface)',
      borderRadius: 'var(--radius-sm)', padding: '12px 14px',
      // Vạch màu bên trái để lướt danh sách là thấy ngay việc trễ hạn.
      borderLeft: `3px solid ${overdue ? 'var(--danger)' : task.Status === 'done' ? 'var(--success)' : 'var(--accent)'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{task.Title}</strong>
            <StatusBadge status={task.Status} overdue={overdue} />
          </div>

          {task.Description && (
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{task.Description}</p>
          )}

          {task.PostID && (
            <Link to={`/news/${task.PostID}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12.5, color: 'var(--accent)' }}>
              <IconFileText size={13} />{task.PostTitle || `Bài #${task.PostID}`}
            </Link>
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            <span>Người giao: {task.AssignerName || '—'}</span>
            <span>Người nhận: {task.AssigneeName || '—'}</span>
            <span>Nhận việc: {formatDateTime(task.AssignedAt)}</span>
            <span style={overdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
              Hạn: {task.DueAt ? formatDateTime(task.DueAt) : 'không đặt hạn'}
            </span>
            {task.CompletedAt && <span>Hoàn thành: {formatDateTime(task.CompletedAt)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onChangeStatus && (
            <select
              value={task.Status}
              disabled={busy}
              onChange={(e) => onChangeStatus(task, e.target.value)}
              aria-label={`Trạng thái của việc: ${task.Title}`}
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)',
                cursor: busy ? 'wait' : 'pointer'
              }}
            >
              {TASK_STATUSES.map(status => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          )}

          {onEdit && (
            <button onClick={() => onEdit(task)} aria-label={`Sửa việc: ${task.Title}`} title="Sửa" style={iconBtn('var(--text)')}>
              <IconEdit size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(task)} aria-label={`Xóa việc: ${task.Title}`} title="Xóa" style={iconBtn('var(--danger)')}>
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
