import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';

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

  if (loading) return <div style={{ padding: 20 }}>Đang tải danh sách nhân sự...</div>;

  return (
    <div style={{ padding: '10px' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>👥 Quản lý Nhân sự & Phân quyền</h2>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f8f9fa' }}>
              <th style={{ padding: '15px' }}>ID</th>
              <th style={{ padding: '15px' }}>Thông tin User</th>
              <th style={{ padding: '15px' }}>Phòng ban</th>
              <th style={{ padding: '15px' }}>Vai trò hiện tại</th>
              <th style={{ padding: '15px' }}>Thay đổi quyền</th>
              <th style={{ padding: '15px' }}>Thao tác</th>
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
                <tr key={uid} style={{ borderBottom: '1px solid #f1f1f1' }}>
                  <td style={{ padding: '15px' }}>#{uid}</td>
                  <td style={{ padding: '15px' }}>
                    <strong>{fullName}</strong><br/>
                    <small style={{ color: '#7f8c8d' }}>@{username}</small>
                  </td>
                  <td style={{ padding: '15px' }}>{department}</td>
                  <td style={{ padding: '15px' }}>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                      background: role === 'Admin' ? '#ffebee' : '#e3f2fd',
                      color: role === 'Admin' ? '#c62828' : '#1565c0'
                    }}>
                      {role}
                    </span>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <select
                      value={role}
                      onChange={(e) => handleChangeRole(uid, e.target.value)}
                      style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd', outline: 'none' }}
                    >
                      <option value="CTV">Cộng tác viên (CTV)</option>
                      <option value="Người duyệt">Người duyệt</option>
                      <option value="Thư ký">Thư ký</option>
                      <option value="Trưởng ban">Trưởng ban</option>
                      <option value="Admin">Quản trị viên (Admin)</option>
                      <option value="Kiểm soát viên">Kiểm soát viên</option>
                    </select>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <button 
                      onClick={() => handleDeleteUser(uid, fullName)}
                      style={{ background: '#ff4d4f', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
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

export default UserManagement;