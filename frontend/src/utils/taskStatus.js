// Nhãn hiển thị cho 3 mã trạng thái mà backend lưu (xem backend/utils/taskStatus.js).
// DB chỉ giữ mã ASCII; mọi chữ tiếng Việt người dùng nhìn thấy đều sinh từ đây, nên đổi
// cách gọi ("Chưa làm" -> "Chờ xử lý") chỉ phải sửa đúng một chỗ.
export const TASK_STATUSES = Object.freeze(['pending', 'in_progress', 'done']);

export const STATUS_LABELS = Object.freeze({
  pending: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành'
});

// Màu lấy từ token có sẵn trong src/styles/theme.css nên tự hợp cả nền sáng lẫn tối.
export const STATUS_COLORS = Object.freeze({
  pending: { fg: 'var(--text-muted)', bg: 'var(--surface-2)' },
  in_progress: { fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  done: { fg: 'var(--success)', bg: 'var(--success-soft)' }
});

export const statusLabel = (status) => STATUS_LABELS[status] || status || '—';

// Giống hệt luật bên backend: việc đã xong thì thôi bêu trễ, kể cả khi nộp muộn.
export const isOverdue = (task, now = new Date()) => {
  if (!task?.DueAt || task.Status === 'done') return false;
  return new Date(task.DueAt).getTime() < now.getTime();
};
