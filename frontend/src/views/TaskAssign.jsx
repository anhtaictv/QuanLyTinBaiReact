import React, { useState, useEffect, useCallback } from 'react';
import { getAssignedTasks, createTask, updateTask, deleteTask, getWorkload } from '../services/taskService';
import { getBasicUsers } from '../services/chatService';
import { getNews } from '../services/newsService';
import { showToastSuccess, showToastError } from '../utils/Toast';
import { monthRange, toDateTimeLocalValue } from '../utils/taskDates';
import LoadingState from '../components/LoadingState';
import TaskItem from '../components/tasks/TaskItem';
import { IconClipboard, IconAlertCircle, IconLoader, IconX, IconUsers } from '../components/icons';

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', padding: 24,
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
};
const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit'
};
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--text)' };

const EMPTY_FORM = { Title: '', Description: '', AssigneeID: '', DueAt: '', PostID: '' };

// Trang giao việc: form ở trên, danh sách việc đã giao trong tháng ở dưới. Sửa việc dùng
// lại chính form đó (đổ dữ liệu cũ vào) thay vì dựng thêm modal riêng — một form, một
// luật kiểm tra, không sợ hai chỗ lệch nhau.
const TaskAssign = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoadingList(true);
    try {
      const now = new Date();
      const { from, to } = monthRange(now.getFullYear(), now.getMonth());
      const { data } = await getAssignedTasks(from, to);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tải được danh sách việc đã giao.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    getBasicUsers().then(res => setUsers(res.data || [])).catch(() => setUsers([]));
    // Backend đã gộp sẵn theo API riêng cho ASSIGN_ROLES — CTV gọi route này sẽ bị 403,
    // nên lỗi (kể cả 403) chỉ cần rơi về mảng rỗng, không chặn phần còn lại của trang.
    getWorkload().then(res => setWorkload(res.data?.workload || [])).catch(() => setWorkload([]));
    // Chỉ lấy trang đầu của danh sách bài (API /news có phân trang) — đủ cho việc gắn bài
    // mới viết, việc cũ hơn thì ghi tên bài vào phần mô tả. Chấp cả hai kiểu trả về vì
    // /news có nơi trả {posts}, có nơi trả thẳng mảng (xem Dashboard.jsx).
    getNews()
      .then(res => setPosts(res.data?.posts || (Array.isArray(res.data) ? res.data : [])))
      .catch(() => setPosts([]));
    fetchTasks();
  }, [fetchTasks]);

  // Danh sách người nhận sắp theo việc đang mở tăng dần (workload đã sắp sẵn từ server) —
  // ai rảnh nhất hiện lên đầu, gợi ý luôn thay vì bắt người giao việc tự nhớ ai đang bận.
  const workloadById = new Map(workload.map(w => [w.UserID, w]));
  const sortedUsers = [...users].sort((a, b) => {
    const openA = workloadById.get(a.UserID)?.OpenCount ?? 0;
    const openB = workloadById.get(b.UserID)?.OpenCount ?? 0;
    return openA - openB;
  });
  const leastLoadedId = workload[0]?.UserID;

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.Title.trim()) return setError('Vui lòng nhập tên công việc.');
    if (!editingId && !form.AssigneeID) return setError('Vui lòng chọn người nhận việc.');

    const payload = {
      Title: form.Title.trim(),
      Description: form.Description.trim() || null,
      // <input type="datetime-local"> trả giờ địa phương không kèm múi giờ; đổi qua Date
      // rồi toISOString() để backend nhận đúng mốc UTC, không lệch 7 tiếng.
      DueAt: form.DueAt ? new Date(form.DueAt).toISOString() : null,
      PostID: form.PostID ? Number(form.PostID) : null
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateTask(editingId, payload);
        showToastSuccess('Đã cập nhật công việc.');
      } else {
        await createTask({ ...payload, AssigneeID: Number(form.AssigneeID) });
        showToastSuccess('Đã giao việc, người nhận sẽ nhận được thông báo.');
      }
      resetForm();
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Không lưu được công việc.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (task) => {
    setEditingId(task.TaskID);
    setForm({
      Title: task.Title || '',
      Description: task.Description || '',
      AssigneeID: String(task.AssigneeID || ''),
      DueAt: toDateTimeLocalValue(task.DueAt),
      PostID: task.PostID ? String(task.PostID) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Thu hồi công việc "${task.Title}"? Người nhận sẽ không còn thấy việc này.`)) return;
    try {
      await deleteTask(task.TaskID);
      showToastSuccess('Đã thu hồi công việc.');
      if (editingId === task.TaskID) resetForm();
      fetchTasks();
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không thu hồi được công việc.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860, margin: '0 auto' }}>
      <div style={card}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <IconClipboard size={18} style={{ color: 'var(--accent)' }} />
            {editingId ? 'Sửa công việc' : 'Giao việc'}
          </h3>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: 13 }}>
            Việc giao xong sẽ hiện trên lịch của người nhận kèm thông báo đẩy.
          </p>
        </div>

        {error && (
          <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', background: 'var(--danger-soft)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13.5 }}>
            <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="task-title">Tên công việc</label>
            <input id="task-title" style={inputStyle} value={form.Title} maxLength={300}
              onChange={(e) => setField('Title', e.target.value)}
              placeholder="VD: Viết bài về hội nghị nông nghiệp huyện" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="task-desc">Mô tả / yêu cầu cụ thể</label>
            <textarea id="task-desc" rows={4} style={{ ...inputStyle, resize: 'vertical' }} value={form.Description}
              onChange={(e) => setField('Description', e.target.value)}
              placeholder="Nội dung cần làm, nguồn tư liệu, người liên hệ..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="task-assignee">Người nhận việc</label>
              <select id="task-assignee" style={inputStyle} value={form.AssigneeID} disabled={!!editingId}
                onChange={(e) => setField('AssigneeID', e.target.value)}>
                <option value="">-- Chọn người nhận --</option>
                {sortedUsers.map(user => {
                  const w = workloadById.get(user.UserID);
                  const label = w
                    ? `${user.FullName} (${user.Role}) — ${w.OpenCount} đang làm, ${w.DoneCount} đã xong${w.OverdueCount ? `, ${w.OverdueCount} quá hạn` : ''}${user.UserID === leastLoadedId ? ' ⭐ rảnh nhất' : ''}`
                    : `${user.FullName} (${user.Role})`;
                  return <option key={user.UserID} value={user.UserID}>{label}</option>;
                })}
              </select>
              {editingId && (
                // Đổi người nhận giữa chừng làm hỏng lịch sử tiến độ của người cũ; muốn
                // chuyển người thì thu hồi rồi giao lại cho rõ ràng.
                <p style={{ margin: '5px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Không đổi được người nhận khi sửa — thu hồi rồi giao lại nếu cần chuyển người.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle} htmlFor="task-due">Hạn hoàn thành</label>
              <input id="task-due" type="datetime-local" style={inputStyle} value={form.DueAt}
                onChange={(e) => setField('DueAt', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="task-post">Bài viết liên quan (không bắt buộc)</label>
            <select id="task-post" style={inputStyle} value={form.PostID} onChange={(e) => setField('PostID', e.target.value)}>
              <option value="">-- Không gắn bài nào --</option>
              {posts.map(post => (
                <option key={post.PostID} value={post.PostID}>{post.Title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={submitting} style={{
              flex: 1, background: submitting ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)',
              padding: 12, border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 15,
              cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              {submitting ? <><IconLoader size={16} />Đang lưu...</> : (editingId ? 'Lưu thay đổi' : 'Giao việc')}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', fontSize: 13.5,
                border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer'
              }}>
                <IconX size={14} />Hủy sửa
              </button>
            )}
          </div>
        </form>
      </div>

      {workload.length > 0 && (
        <div style={card}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, marginBottom: 14 }}>
            <IconUsers size={16} style={{ color: 'var(--accent)' }} />
            Khối lượng công việc hiện tại
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workload.map(w => (
              <div key={w.UserID} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: w.UserID === leastLoadedId ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface-2)',
                fontSize: 13.5
              }}>
                <span>
                  {w.FullName} <span style={{ color: 'var(--text-muted)' }}>({w.Role})</span>
                  {w.UserID === leastLoadedId && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>⭐ Đề xuất</span>}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {w.OpenCount} đang làm · {w.DoneCount} đã xong
                  {w.OverdueCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {w.OverdueCount} quá hạn</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <h4 style={{ fontSize: 15, marginBottom: 14 }}>Việc đã giao trong tháng này ({tasks.length})</h4>

        {loadingList ? (
          <LoadingState label="Đang tải..." padding={24} />
        ) : tasks.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>Tháng này chưa giao việc nào.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.map(task => (
              <TaskItem key={task.TaskID} task={task} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAssign;
