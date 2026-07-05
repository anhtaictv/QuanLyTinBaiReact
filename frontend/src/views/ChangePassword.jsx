import React, { useState } from 'react';
import api from '../services/api';
import { IconKey, IconCheckCircle, IconAlertCircle } from '../components/icons';

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
    width: '100%', padding: '11px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
    fontSize: '15px', boxSizing: 'border-box'
  };
  const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13.5, color: 'var(--text)' };

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconKey size={17} style={{ color: 'var(--accent)' }} />Đổi mật khẩu
      </h3>

      {msg.text && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: 11, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13.5,
          background: msg.type === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)',
          color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)'
        }}>
          {msg.type === 'success' ? <IconCheckCircle size={16} style={{ marginTop: 1 }} /> : <IconAlertCircle size={16} style={{ marginTop: 1 }} />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mật khẩu hiện tại</label>
          <input name="oldPassword" type="password" autoComplete="current-password" value={form.oldPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mật khẩu mới</label>
          <input name="newPassword" type="password" autoComplete="new-password" value={form.newPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Xác nhận mật khẩu mới</label>
          <input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} style={inputStyle} required />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: loading ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;
