import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUpcomingTasks } from '../../services/taskService';
import { formatDateTime } from '../../utils/taskDates';
import { isOverdue } from '../../utils/taskStatus';
import StatusBadge from './StatusBadge';
import { IconCalendar, IconChevronRight } from '../icons';

// Ô tóm tắt trên Dashboard: chỉ vài việc gần hạn nhất, chưa xong. Cố ý KHÔNG nhúng cả
// lịch tháng vào đây — Dashboard đã nặng sẵn vì biểu đồ, lịch đầy đủ nằm ở /tasks.
const UpcomingTasksPanel = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getUpcomingTasks()
      .then(res => { if (alive) setTasks(res.data?.tasks || []); })
      // Việc cần làm hỏng thì Dashboard vẫn phải hiện: nuốt lỗi ở đây là cố ý, ô này chỉ
      // rút gọn dữ liệu đã có trang riêng, không đáng để làm vỡ cả trang chủ.
      .catch(() => { if (alive) setTasks([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading || tasks.length === 0) return null;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 20, marginBottom: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <h3 style={{ fontSize: 15.5, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCalendar size={16} style={{ color: 'var(--accent)' }} />Việc cần làm ({tasks.length})
        </h3>
        <Link to="/tasks" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)' }}>
          Xem lịch<IconChevronRight size={13} />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => {
          const overdue = isOverdue(task);
          return (
            <div key={task.TaskID} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '9px 12px', border: '1px solid var(--border)', background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.Title}
                </div>
                <div style={{ fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                  Hạn: {task.DueAt ? formatDateTime(task.DueAt) : 'không đặt hạn'} · giao bởi {task.AssignerName || '—'}
                </div>
              </div>
              <StatusBadge status={task.Status} overdue={overdue} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingTasksPanel;
