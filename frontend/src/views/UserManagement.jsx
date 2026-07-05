import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';
import { IconUsers, IconTrash } from '../components/icons';
import LoadingState from '../components/LoadingState';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      // Xử lý dữ liệu từ recordset của SQL Server hoặc mảng trực tiếp
      const data = Array.isArray(res.data) ? res.data : (res.data.recordset || []);
      setUsers(data);
    } catch (err) {
      showToastError('Lỗi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!newRole) return;
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      showToastSuccess(`Đã chuyển sang quyền: ${newRole}`);
      fetchUsers(); // Refresh lại danh sách
    } catch (err) {
      showToastError('Cập nhật quyền thất bại');
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${name}"? Thao tác này không thể hoàn tác.`)) {
      try {
        await api.delete(`/users/${userId}`);
        showToastSuccess('Xóa người dùng thành công');
        fetchUsers();
      } catch (err) {
        showToastError('Không thể xóa người dùng này');
      }
    }
  };

  if (loading) return <LoadingState label="Đang tải danh sách nhân sự..." />;

  return (
    <div>
      <h2 style={{ marginBottom: '20px', fontSize: 22, display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconUsers size={19} style={{ color: 'var(--accent)' }} />Quản lý Nhân sự &amp; Phân quyền
      </h2>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={th}>ID</th>
              <th style={th}>Thông tin User</th>
              <th style={th}>Phòng ban</th>
              <th style={th}>Vai trò hiện tại</th>
              <th style={th}>Thay đổi quyền</th>
              <th style={th}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const uid = user.UserID || user.userID;
              const username = user.Username || user.username;
              const fullName = user.FullName || user.fullName;
              const department = user.Department || user.department || 'Chưa rõ';
              const role = user.Role || user.role;

              return (
                <tr key={uid} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="mono" style={{ ...td, color: 'var(--text-muted)' }}>#{uid}</td>
                  <td style={td}>
                    <strong>{fullName}</strong><br/>
                    <small style={{ color: 'var(--text-muted)' }}>@{username}</small>
                  </td>
                  <td style={td}>{department}</td>
                  <td style={td}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
                      background: role === 'Admin' ? 'var(--danger-soft)' : 'var(--accent-soft)',
                      color: role === 'Admin' ? 'var(--danger)' : 'var(--accent)'
                    }}>
                      {role}
                    </span>
                  </td>
                  <td style={td}>
                    <select
                      value={role}
                      onChange={(e) => handleChangeRole(uid, e.target.value)}
                      style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', outline: 'none' }}
                    >
                      <option value="CTV">Cộng tác viên (CTV)</option>
                      <option value="Người duyệt">Người duyệt</option>
                      <option value="Thư ký">Thư ký</option>
                      <option value="Trưởng ban">Trưởng ban</option>
                      <option value="Admin">Quản trị viên (Admin)</option>
                      <option value="Kiểm soát viên">Kiểm soát viên</option>
                    </select>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => handleDeleteUser(uid, fullName)}
                      style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: 'none', padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}
                    >
                      <IconTrash size={13} />Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const th = { padding: '13px 15px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 };
const td = { padding: '13px 15px', fontSize: 14 };

export default UserManagement;
