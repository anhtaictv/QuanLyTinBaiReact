import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor Request: Gắn Token vào mọi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor Response: Nếu 401 thì về login, KHÔNG refresh
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error:', 
      error.response?.status, 
      error.response?.data, 
      error.config?.url
    );

    // Chỉ redirect về login nếu 401 VÀ không phải đang gọi /login
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/login')
    ) {
      localStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;