import React, { useState } from 'react';
import api from '../services/api';

const ChangePassword = () => {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (form.newPassword !== form.confirmPassword) {
      return setMsg({ text: 'Mật khẩu mới không khớp!', type: 'error' });
    }
    if (form.newPassword.length < 6) {
      return setMsg({ text: 'Mật khẩu mới phải ít nhất 6 ký tự!', type: 'error' });
    }

    setLoading(true);
    try {
      const res = await api.post('/change-password', {
        OldPassword: form.oldPassword,
        NewPassword: form.newPassword,
      });
      setMsg({ text: res.data.message, type: 'success' });
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Lỗi server!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: 'white', padding: 30, borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #f0f0f0', paddingBottom: 10 }}>
        🔑 Đổi mật khẩu
      </h3>

      {msg.text && (
        <div style={{ padding: 12, borderRadius: 6, marginBottom: 16, background: msg.type === 'success' ? '#e8f5e9' : '#ffebee', color: msg.type === 'success' ? '#2e7d32' : '#c62828' }}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#555' }}>Mật khẩu hiện tại</label>
          <input name="oldPassword" type="password" value={form.oldPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#555' }}>Mật khẩu mới</label>
          <input name="newPassword" type="password" value={form.newPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#555' }}>Xác nhận mật khẩu mới</label>
          <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#95a5a6' : '#3498db', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;