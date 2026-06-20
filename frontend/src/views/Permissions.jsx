import React, { useEffect, useState } from 'react';
import api from '../services/api';

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

  if (loading) return <div>Đang tải dữ liệu...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ color: '#2c3e50', marginBottom: 20 }}>⚖️ Quản lý Phân Quyền (Chỉnh sửa Role)</h2>
      <p style={{ color: '#7f8c8d', marginBottom: 20 }}>
        Bảng dưới đây cho phép bạn thay đổi quyền hạn (Role) hoặc Xóa người dùng.
      </p>

      <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#34495e', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: 12 }}>ID User</th>
              <th style={{ padding: 12 }}>Họ và Tên</th>
              <th style={{ padding: 12 }}>Username</th>
              <th style={{ padding: 12 }}>Phòng ban</th>
              <th style={{ padding: 12 }}>Vai trò hiện tại</th>
              <th style={{ padding: 12 }}>Thay đổi quyền</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              // ✅ FIX: Đọc cả 2 dạng hoa/thường để tương thích với SQL Server
              const uid        = user.UserID     || user.userID;
              const fullName   = user.FullName   || user.fullName   || '-';
              const username   = user.Username   || user.username   || '-';
              const department = user.Department || user.department || '-';
              const role       = user.Role       || user.role       || '-';

              return (
                <tr key={uid} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 12 }}>{uid}</td>
                  <td style={{ padding: 12, fontWeight: 500 }}>{fullName}</td>
                  <td style={{ padding: 12 }}>{username}</td>
                  <td style={{ padding: 12 }}>{department}</td>

                  <td style={{ padding: 12 }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: '#e1f5fe',
                      color: '#01579b',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {role}
                    </span>
                  </td>

                  <td style={{ padding: 12 }}>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(uid, e.target.value)}
                      style={{
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        minWidth: '140px',
                        marginRight: '8px',
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
                        background: '#c0392b',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                      }}
                    >
                      🗑️ Xóa
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

export default Permissions;