// src/hooks/usePushNotification.js
import { useState, useEffect } from 'react';
import api from '../services/api';

// Convert VAPID public key từ base64 sang Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotification() {
  const [permission,  setPermission]  = useState(('Notification' in window) ? Notification.permission : 'default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);

  // Kiểm tra đã subscribe chưa khi mount
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {}
  };

  const subscribe = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Trình duyệt này không hỗ trợ Push Notification!');
      return;
    }

    setLoading(true);
    try {
      // 1. Xin quyền
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('Bạn cần cho phép thông báo để nhận tin!');
        return;
      }

      // 2. Lấy VAPID public key từ server
      const keyRes    = await api.get('/push/vapidPublicKey');
      const publicKey = keyRes.data.publicKey;

      // 3. Đăng ký Service Worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 4. Tạo subscription
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Gửi subscription lên server
      await api.post('/push/subscribe', { subscription });
      setSubscribed(true);
      console.log('✅ Đã đăng ký Push Notification');

    } catch (err) {
      console.error('❌ Push subscribe lỗi:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.post('/push/unsubscribe');
      setSubscribed(false);
    } catch (err) {
      console.error('❌ Push unsubscribe lỗi:', err);
    } finally {
      setLoading(false);
    }
  };

  return { permission, subscribed, loading, subscribe, unsubscribe };
}