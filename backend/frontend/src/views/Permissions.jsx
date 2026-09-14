import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { IconShield, IconTrash } from '../components/icons';
import LoadingState from '../components/LoadingState';

const Permissions = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const roleOptions = [
    { id: 1, name: 'CTV' },
    { id: 2, name: 'Người duyệt' },
    { id: 3, name: 'Trưởng ban' },
    { id: 4, name: 'Admin' },
    { id: 5, name: 'Thư ký' },
    { id: 6, name: 'Kiểm soát viên' },
  ];

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      alert('Lỗi tải danh sách user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    if (window.confirm(`Bạn muốn đổi quyền người dùng này thành "${newRole}"?`)) {
      try {
        await api.put(`/users/${userId}/role`, { role: newRole });
        alert('Cập nhật quyền thành công!');
        fetchUsers();
      } catch (err) {
        alert('Lỗi cập nhật quyền: ' + (err.response?.data || err.message));
      }
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`Bạn chắc chắn muốn xóa user "${userName}"?\n(Lưu ý: Các bài viết của họ sẽ được giữ lại)`)) {
      try {
        await api.delete(`/users/${userId}`);
        alert('Đã xóa người dùng thành công!');
        fetchUsers();
      } catch (err) {
        alert('Lỗi khi xóa: ' + (err.response?.data || err.message));
      }
    }
  };

  if (loading) return <LoadingState label="Đang tải dữ liệu..." />;

  return (
    <div>
      <h2 style={{ marginBottom: 8, fontSize: 22, display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconShield size={19} style={{ color: 'var(--accent)' }} />Quản lý Phân Quyền
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13.5 }}>
        Bảng dưới đây cho phép bạn thay đổi quyền hạn (Role) hoặc Xóa người dùng.
      </p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 10, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)', textAlign: 'left' }}>
              <th style={th}>ID User</th>
              <th style={th}>Họ và Tên</th>
              <th style={th}>Username</th>
              <th style={th}>Phòng ban</th>
              <th style={th}>Vai trò hiện tại</th>
              <th style={th}>Thay đổi quyền</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              // FIX: Đọc cả 2 dạng hoa/thường để tương thích với SQL Server
              const uid        = user.UserID     || user.userID;
              const fullName   = user.FullName   || user.fullName   || '-';
              const username   = user.Username   || user.username   || '-';
              const department = user.Department || user.department || '-';
              const role       = user.Role       || user.role       || '-';

              return (
                <tr key={uid} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="mono" style={{ ...td, color: 'var(--text-muted)' }}>{uid}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{fullName}</td>
                  <td style={td}>{username}</td>
                  <td style={td}>{department}</td>

                  <td style={td}>
                    <span style={{
                      padding: '4px 9px',
                      borderRadius: '999px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: '12px'
                    }}>
                      {role}
                    </span>
                  </td>

                  <td style={{ ...td, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(uid, e.target.value)}
                      style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        minWidth: '140px',
                        cursor: 'pointer'
                      }}
                    >
                      {roleOptions.map(opt => (
                        <option key={opt.id} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleDeleteUser(uid, fullName)}
                      title="Xóa người dùng (Giữ lại bài viết)"
                      style={{
                        background: 'var(--danger-soft)',
                        color: 'var(--danger)',
                        border: 'none',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                        display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
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

const th = { padding: 12, fontSize: 12.5, fontWeight: 600 };
const td = { padding: 12, fontSize: 14 };

export default Permissions;
