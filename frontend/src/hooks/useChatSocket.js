import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketSingleton = null;

function createSocket() {
  const token = localStorage.getItem('token');
  const apiUrl = process.env.REACT_APP_API_URL || '/api';
  const base = /^https?:\/\//.test(apiUrl)
    ? apiUrl.replace(/\/api\/?$/, '')
    : window.location.origin;
  return io(base, { auth: { token }, transports: ['websocket', 'polling'] });
}

// Kết nối socket dùng chung toàn app (singleton) — ChatBell cần nhận sự kiện
// ngay cả khi không ở trang /chat, nên không thể gắn theo vòng đời 1 component.
export function getChatSocket() {
  if (!socketSingleton) socketSingleton = createSocket();
  return socketSingleton;
}

export function disconnectChatSocket() {
  if (socketSingleton) {
    socketSingleton.disconnect();
    socketSingleton = null;
  }
}

export function useChatSocket() {
  const socketRef = useRef(getChatSocket());
  useEffect(() => {
    socketRef.current = getChatSocket();
  }, []);
  return socketRef.current;
}
