import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { IconEye, IconEyeOff, IconAlertCircle, IconCheckCircle } from '../components/icons';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    age: '',
    department: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      if (isRegister) {
        // --- LOGIC ĐĂNG KÝ ---
        // Gửi đầy đủ các trường khớp với bảng dbo.Users trong SQL Server
        await api.post('/register', {
          Username: formData.username,
          Password: formData.password,
          FullName: formData.fullName,
          Age: formData.age ? parseInt(formData.age) : null,
          Department: formData.department,
          Email: formData.email
        });

        setSuccessMessage('Đăng ký thành công! Xin mời đăng nhập.');
        setTimeout(() => {
          setIsRegister(false);
          setSuccessMessage('');
        }, 1500);

      } else {
        // --- LOGIC ĐĂNG NHẬP ---
        const response = await api.post('/login', {
          Username: formData.username,
          Password: formData.password
        });
        const data = response.data;

        // Lưu Token và RefreshToken để api.js tự động gia hạn phiên
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        const userProfile = data.user || data;
        localStorage.setItem('user', JSON.stringify(userProfile));

        navigate('/dashboard');
      }
    } catch (err) {
      // Xử lý thông báo lỗi từ server hoặc lỗi kết nối VPS
      const errorMsg = err.response?.data?.message || err.response?.data || 'Lỗi kết nối đến VPS';
      setError(typeof errorMsg === 'string' ? errorMsg : 'Thao tác thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
    fontSize: 15, boxSizing: 'border-box'
  };
  const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '40px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-3 3.5Z"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '0.02em', color: 'var(--text)' }}>QUẢN LÝ TIN</span>
        </div>
        <h2 style={{ textAlign: 'center', color: 'var(--text)', fontSize: 22, marginBottom: 28 }}>
          {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
        </h2>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--danger)', background: 'var(--danger-soft)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13.5, marginBottom: 16 }}>
            <IconAlertCircle size={16} style={{ marginTop: 1 }} /><span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--success)', background: 'var(--success-soft)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13.5, marginBottom: 16 }}>
            <IconCheckCircle size={16} style={{ marginTop: 1 }} /><span>{successMessage}</span>
          </div>
        )}

        {isRegister && (
          <>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Họ và tên</label>
              <input name="fullName" type="text" placeholder="Nguyễn Văn A" required value={formData.fullName} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Đơn vị</label>
              <input name="department" type="text" placeholder="Ban Tuyên truyền" value={formData.department} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Tuổi</label>
              <input name="age" type="number" placeholder="25" value={formData.age} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Email (để lấy lại mật khẩu khi quên)</label>
              <input name="email" type="email" autoComplete="email" placeholder="ten@gmail.com" value={formData.email} onChange={handleChange} style={inputStyle} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Tên đăng nhập</label>
          <input
            name="username" type="text" autoComplete="username" placeholder="ten.dangnhap" required
            value={formData.username} onChange={handleChange} style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Mật khẩu</label>
          <div style={{ position: 'relative' }}>
            <input
              name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" required
              value={formData.password} onChange={handleChange} style={{ ...inputStyle, paddingRight: 42 }}
            />
            <button
              type="button" onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            >
              {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
            </button>
          </div>
          {!isRegister && (
            <Link to="/forgot-password" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>
              Quên mật khẩu?
            </Link>
          )}
        </div>

        <button
          type="submit" disabled={submitting}
          style={{
            width: '100%', padding: '12px', background: submitting ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 15, boxShadow: 'var(--shadow-sm)'
          }}
        >
          {submitting ? 'Đang xử lý…' : (isRegister ? 'Tạo tài khoản mới' : 'Đăng nhập')}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--text-muted)' }}>
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <span
            onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMessage(''); }}
            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, marginLeft: 5 }}
          >
            {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tại đây'}
          </span>
        </p>
      </form>
    </div>
  );
};

export default Login;
