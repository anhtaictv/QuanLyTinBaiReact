import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { IconArrowLeft, IconAlertCircle, IconCheckCircle, IconMail } from '../components/icons';

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  fontSize: 15, boxSizing: 'border-box'
};
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' };

const ForgotPassword = () => {
  const [form, setForm] = useState({ username: '', email: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    setSubmitting(true);
    try {
      const res = await api.post('/forgot-password', { Username: form.username, Email: form.email });
      setMsg({ text: res.data.message, type: 'success' });
      setSent(true);
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Lỗi kết nối đến server', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 40, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <IconMail size={26} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 style={{ textAlign: 'center', color: 'var(--text)', fontSize: 22, marginBottom: 8 }}>Quên mật khẩu</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24 }}>
          Nhập tên đăng nhập và email đã đăng ký để nhận link đặt lại mật khẩu.
        </p>

        {msg.text && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13.5, marginBottom: 16,
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            background: msg.type === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)'
          }}>
            {msg.type === 'success' ? <IconCheckCircle size={16} style={{ marginTop: 1 }} /> : <IconAlertCircle size={16} style={{ marginTop: 1 }} />}
            <span>{msg.text}</span>
          </div>
        )}

        {!sent && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Tên đăng nhập</label>
              <input name="username" type="text" autoComplete="username" placeholder="ten.dangnhap" required value={form.username} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Email đã đăng ký</label>
              <input name="email" type="email" autoComplete="email" placeholder="ten@gmail.com" required value={form.email} onChange={handleChange} style={inputStyle} />
            </div>
            <button
              type="submit" disabled={submitting}
              style={{
                width: '100%', padding: 12, background: submitting ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 15, boxShadow: 'var(--shadow-sm)'
              }}
            >
              {submitting ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
            </button>
          </form>
        )}

        <Link to="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, fontSize: 13.5, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <IconArrowLeft size={14} />Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
