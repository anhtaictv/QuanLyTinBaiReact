import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    age: '',
    department: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      if (isRegister) {
        // --- LOGIC ĐĂNG KÝ ---
        // Gửi đầy đủ các trường khớp với bảng dbo.Users trong SQL Server
        await api.post('/register', {
          Username: formData.username,
          Password: formData.password,
          FullName: formData.fullName,
          Age: formData.age ? parseInt(formData.age) : null,
          Department: formData.department
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
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '400px' }}>
        <h2 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: '30px' }}>
          {isRegister ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP'}
        </h2>

        {error && <p style={{ color: 'red', textAlign: 'center', fontSize: '14px', marginBottom: '15px' }}>{error}</p>}
        {successMessage && <p style={{ color: 'green', textAlign: 'center', fontSize: '14px', marginBottom: '15px' }}>{successMessage}</p>}

        {isRegister && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <input
                name="fullName"
                type="text" placeholder="Họ và tên" required
                value={formData.fullName}
                onChange={handleChange}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <input
                name="department"
                type="text" placeholder="Đơn vị"
                value={formData.department}
                onChange={handleChange}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <input
                name="age"
                type="number" placeholder="Tuổi"
                value={formData.age}
                onChange={handleChange}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

        <div style={{ marginBottom: '15px' }}>
          <input
            name="username"
            type="text" placeholder="Tên đăng nhập" required
            value={formData.username}
            onChange={handleChange}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <input
            name="password"
            type="password" placeholder="Mật khẩu" required
            value={formData.password}
            onChange={handleChange}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: '12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          {isRegister ? 'TẠO TÀI KHOẢN MỚI' : 'ĐĂNG NHẬP'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <span
            onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMessage(''); }}
            style={{ color: '#1a73e8', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}
          >
            {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tại đây'}
          </span>
        </p>
      </form>
    </div>
  );
};

export default Login;