import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { IconKey, IconEye, IconEyeOff, IconAlertCircle, IconCheckCircle, IconArrowLeft } from '../components/icons';

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  fontSize: 15, boxSizing: 'border-box'
};
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' };

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (!token) {
      return setMsg({ text: 'Thiếu token đặt lại mật khẩu — vui lòng dùng đúng link trong email.', type: 'error' });
    }
    if (form.newPassword !== form.confirmPassword) {
      return setMsg({ text: 'Mật khẩu mới không khớp!', type: 'error' });
    }
    if (form.newPassword.length < 6) {
      return setMsg({ text: 'Mật khẩu mới phải ít nhất 6 ký tự!', type: 'error' });
    }

    setSubmitting(true);
    try {
      const res = await api.post('/reset-password', { token, newPassword: form.newPassword });
      setMsg({ text: res.data.message, type: 'success' });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
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
          <IconKey size={26} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 style={{ textAlign: 'center', color: 'var(--text)', fontSize: 22, marginBottom: 24 }}>Đặt lại mật khẩu</h2>

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

        {!token && !done && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--danger)', background: 'var(--danger-soft)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13.5, marginBottom: 16 }}>
            <IconAlertCircle size={16} style={{ marginTop: 1 }} />
            <span>Không tìm thấy token trong link. Vui lòng mở lại link từ email "Đặt lại mật khẩu".</span>
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" required
                  value={form.newPassword} onChange={handleChange} style={{ ...inputStyle, paddingRight: 42 }}
                />
                <button
                  type="button" onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Xác nhận mật khẩu mới</label>
              <input name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" required value={form.confirmPassword} onChange={handleChange} style={inputStyle} />
            </div>
            <button
              type="submit" disabled={submitting || !token}
              style={{
                width: '100%', padding: 12, background: (submitting || !token) ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: (submitting || !token) ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 15, boxShadow: 'var(--shadow-sm)'
              }}
            >
              {submitting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
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

export default ResetPassword;
