import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyTasks, getAssignedTasks, updateTaskStatus } from '../services/taskService';
import { getChatSocket } from '../hooks/useChatSocket';
import { showToastSuccess, showToastError } from '../utils/Toast';
import { monthRange, groupTasksByDay, toDateKey, formatDate } from '../utils/taskDates';
import { canAssignTasks } from '../utils/roles';
import MonthCalendar from '../components/tasks/MonthCalendar';
import TaskItem from '../components/tasks/TaskItem';
import LoadingState from '../components/LoadingState';
import { IconCalendar, IconAlertCircle, IconPlus } from '../components/icons';

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', padding: 24,
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
};

const tabStyle = (active) => ({
  padding: '8px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: active ? 'var(--accent)' : 'var(--surface-2)',
  color: active ? 'var(--accent-fg)' : 'var(--text)'
});

// Lịch công việc: tháng nào cũng nạp đúng khoảng ngày của tháng đó, không nạp cả kho về
// rồi lọc ở client — bảng Tasks sẽ phình theo thời gian còn lịch thì chỉ xem từng tháng.
const TaskCalendar = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(toDateKey(today));
  const [scope, setScope] = useState('mine'); // 'mine' = việc tôi phải làm, 'assigned' = việc tôi đã giao
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState(null);

  const canAssign = canAssignTasks();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = monthRange(year, month);
      const { data } = scope === 'assigned' ? await getAssignedTasks(from, to) : await getMyTasks(from, to);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tải được danh sách công việc.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, scope]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Người giao vừa bấm giao/sửa/thu hồi thì lịch phải đổi ngay, không đợi F5. Nạp lại cả
  // tháng thay vì tự chắp bản ghi vào state: sự kiện có thể rơi vào tháng đang không xem,
  // chắp tay dễ ra lịch sai hơn là gọi lại một lượt.
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return undefined;

    const reload = () => fetchTasks();
    socket.on('task:new', reload);
    socket.on('task:updated', reload);
    socket.on('task:deleted', reload);
    return () => {
      socket.off('task:new', reload);
      socket.off('task:updated', reload);
      socket.off('task:deleted', reload);
    };
  }, [fetchTasks]);

  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const selectedTasks = tasksByDay.get(selectedKey) || [];

  const changeMonth = (delta) => {
    if (delta === 0) {
      const now = new Date();
      setYear(now.getFullYear());
      setMonth(now.getMonth());
      setSelectedKey(toDateKey(now));
      return;
    }
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const handleChangeStatus = async (task, status) => {
    setBusyTaskId(task.TaskID);
    try {
      const { data } = await updateTaskStatus(task.TaskID, status);
      setTasks(prev => prev.map(item => (item.TaskID === task.TaskID ? data.task : item)));
      showToastSuccess('Đã cập nhật tiến độ.');
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không cập nhật được tiến độ.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const doneCount = tasks.filter(t => t.Status === 'done').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980, margin: '0 auto' }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <IconCalendar size={18} style={{ color: 'var(--accent)' }} />Lịch công việc
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: 13 }}>
              Tháng này có {tasks.length} việc, đã xong {doneCount}.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button onClick={() => setScope('mine')} style={tabStyle(scope === 'mine')}>Việc của tôi</button>
            {canAssign && (
              <>
                <button onClick={() => setScope('assigned')} style={tabStyle(scope === 'assigned')}>Việc tôi đã giao</button>
                <Link to="/tasks/assign" style={{ ...tabStyle(false), display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <IconPlus size={14} />Giao việc
                </Link>
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', background: 'var(--danger-soft)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13.5 }}>
            <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
          </div>
        )}

        <MonthCalendar
          year={year} month={month} tasksByDay={tasksByDay}
          selectedKey={selectedKey} onSelectDay={setSelectedKey} onChangeMonth={changeMonth}
        />
      </div>

      <div style={card}>
        <h4 style={{ fontSize: 15, marginBottom: 14 }}>
          Ngày {formatDate(selectedKey)} — {selectedTasks.length} việc
        </h4>

        {loading ? (
          <LoadingState label="Đang tải công việc..." padding={24} />
        ) : selectedTasks.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>
            Không có việc nào trong ngày này. Bấm vào ô ngày khác trên lịch để xem.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedTasks.map(task => (
              <TaskItem
                key={task.TaskID}
                task={task}
                busy={busyTaskId === task.TaskID}
                // Chỉ ở tab "Việc của tôi" mới cho đổi tiến độ; tab việc đã giao là để
                // theo dõi, sửa/xoá nằm ở trang Giao việc cho khỏi bấm nhầm.
                onChangeStatus={scope === 'mine' ? handleChangeStatus : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCalendar;
