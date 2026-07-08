import { useEffect } from 'react';
import api from '../services/api';

const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // 20 phút

// JWT hết hạn cứng sau 24h (server.js). Với người dùng đang thao tác tích cực suốt
// nhiều giờ (vd biên tập bài dài), token cũ dần hết hạn và họ bị văng ra đột ngột giữa
// chừng. Gọi /api/refresh-token định kỳ để lấy token mới, miễn là token hiện tại còn
// hạn — giữ session "trôi" theo hoạt động thật mà không cần cơ chế refresh-token riêng.
// Người dùng idle vẫn bị đăng xuất bởi useIdleLogout (10 phút) như trước giờ.
export default function useSessionRefresh() {
  useEffect(() => {
    const tick = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await api.post('/refresh-token');
        if (res.data?.token) {
          localStorage.setItem('token', res.data.token);
        }
      } catch (err) {
        // Token đã hết hạn thật hoặc mất mạng — không cần xử lý gì, lần request API
        // tiếp theo của user sẽ tự nhận 401 và điều hướng về /login như bình thường.
      }
    };

    const timer = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
