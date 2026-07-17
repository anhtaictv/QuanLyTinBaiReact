import React, { useState, useEffect, useContext } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useIdleLogout from '../hooks/useIdleLogout';
import useSessionRefresh from '../hooks/useSessionRefresh';
import ErrorBell from '../components/ErrorBell';
import ChatBell from '../components/ChatBell';
import { disconnectChatSocket } from '../hooks/useChatSocket';
import { ThemeContext } from '../context/ThemeContext';
import {
  IconGrid, IconList, IconPlus, IconChat, IconKey, IconUsers, IconLogout,
  IconRefresh, IconBell, IconBellOff, IconMenu, IconX, IconSun, IconMoon, IconMail, IconNewspaper
} from '../components/icons';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút không hoạt động thì tự đăng xuất

// ── HELPER: Convert VAPID key ──────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

const MainLayout = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscribed,  setSubscribed]  = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const userObj  = JSON.parse(localStorage.getItem('user'));
  const userRole = (userObj?.role || userObj?.Role || '').toLowerCase();
  const isAdminLevel = ['admin', 'trưởng ban'].includes(userRole);
  const isAdminStrict = userRole === 'admin';
  const BASE_URL = import.meta.env.VITE_API_URL || '/api';

  // Tài khoản tạo trước khi có tính năng "Quên mật khẩu" chưa có Email — nhắc liên tục
  // (không chặn thao tác, chỉ hiển thị banner) tới khi họ tự bổ sung ở trang Đổi mật khẩu.
  const [hasEmail, setHasEmail] = useState(!!(userObj?.Email || userObj?.email));
  useEffect(() => {
    const onEmailUpdated = () => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setHasEmail(!!(u.Email || u.email));
    };
    window.addEventListener('user-email-updated', onEmailUpdated);
    return () => window.removeEventListener('user-email-updated', onEmailUpdated);
  }, []);

  // ── Kiểm tra đã subscribe chưa khi mount ──────────────────────────────────
  useEffect(() => {
    checkSubscription();
  }, []);

  // ── Tự động hỏi xin quyền sau 3 giây ─────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        handleSubscribe();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {}
  };

  const handleSubscribe = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setNotifLoading(true);
    try {
      // 1. Xin quyền
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNotifLoading(false); return; }

      // 2. Lấy VAPID public key
      const token   = localStorage.getItem('token');
      const keyRes  = await fetch(`${BASE_URL}/push/vapidPublicKey`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { publicKey } = await keyRes.json();

      // 3. Đăng ký Service Worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 4. Tạo subscription
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Gửi subscription lên server
      await fetch(`${BASE_URL}/push/subscribe`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`
        },
        body: JSON.stringify({ subscription })
      });

      setSubscribed(true);
      console.log('✅ Đã đăng ký Push Notification');

    } catch (err) {
      console.error('❌ Push subscribe lỗi:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      const token = localStorage.getItem('token');
      await fetch(`${BASE_URL}/push/unsubscribe`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubscribed(false);
    } catch (err) {
      console.error('❌ Push unsubscribe lỗi:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleLogout = () => {
    disconnectChatSocket();
    localStorage.clear();
    navigate('/login');
  };

  useIdleLogout(IDLE_TIMEOUT_MS, handleLogout);
  useSessionRefresh();

  const handleRefresh = () => window.location.reload();

  const menuStyle = (path) => ({
    padding:        '10px 14px',
    cursor:         'pointer',
    borderRadius:   'var(--radius-sm)',
    marginBottom:   '2px',
    transition:     'background 150ms ease, color 150ms ease',
    background:     location.pathname === path ? 'var(--sidebar-active)' : undefined,
    color:          location.pathname === path ? '#fff' : 'var(--sidebar-fg-muted)',
    textDecoration: 'none',
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    fontSize:       '13.5px',
    fontWeight:     500,
  });

  const chipStyle = {
    width: 34, height: 34, borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--sidebar-border)',
    color: 'var(--sidebar-fg)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 150ms ease'
  };

  // ── Nút bật/tắt thông báo ─────────────────────────────────────────────────
  const NotifBtn = () => {
    const notifSupported = 'Notification' in window;
    const denied = notifSupported && Notification.permission === 'denied';
    return (
      <button
        onClick={subscribed ? handleUnsubscribe : handleSubscribe}
        disabled={notifLoading || denied || !notifSupported}
        title={
          !notifSupported ? 'Trình duyệt này không hỗ trợ thông báo đẩy' :
          denied      ? 'Thông báo bị chặn – vào cài đặt trình duyệt để bật' :
          subscribed  ? 'Tắt thông báo' : 'Bật thông báo'
        }
        aria-label={subscribed ? 'Tắt thông báo đẩy' : 'Bật thông báo đẩy'}
        style={{
          ...chipStyle,
          background: subscribed ? 'var(--sidebar-active)' : chipStyle.background,
          cursor:     notifLoading || denied || !notifSupported ? 'not-allowed' : 'pointer',
          opacity:    denied || !notifSupported ? 0.5 : 1,
        }}
      >
        {notifLoading ? <IconRefresh size={16} /> : subscribed ? <IconBell size={16} /> : <IconBellOff size={16} />}
      </button>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Header sidebar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ color: 'var(--sidebar-fg)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconFileBrand /> QUẢN LÝ TIN
        </h2>
        <div style={{ display: 'flex', gap: 5 }}>
          {isAdminStrict && <ErrorBell />}
          <ChatBell />
          <NotifBtn />
          <button onClick={handleRefresh} aria-label="Tải lại trang" title="Tải lại trang" style={chipStyle}><IconRefresh size={15} /></button>
        </div>
      </div>

      {/* Trạng thái thông báo */}
      <div style={{
        marginBottom: 14, padding: '8px 10px',
        background:   'rgba(0,0,0,0.18)', borderRadius: 'var(--radius-sm)',
        fontSize:     11.5, lineHeight: 1.5,
        color: ('Notification' in window && Notification.permission === 'denied') ? '#E0A08F'
             : subscribed ? '#8FCBA8' : 'var(--sidebar-fg-muted)'
      }}>
        {!('Notification' in window)
          ? 'Trình duyệt này không hỗ trợ thông báo đẩy'
          : Notification.permission === 'denied'
            ? 'Thông báo bị chặn – vào cài đặt trình duyệt để bật'
            : subscribed
              ? 'Thông báo đang bật'
              : 'Chưa bật thông báo đẩy'}
      </div>

      {/* Menu */}
      <div style={{ flex: 1 }}>
        <Link className="side-nav-link" to="/dashboard"       style={menuStyle('/dashboard')}       onClick={() => setSidebarOpen(false)}><IconGrid size={17}/>Dashboard</Link>
        <Link className="side-nav-link" to="/news"            style={menuStyle('/news')}            onClick={() => setSidebarOpen(false)}><IconList size={17}/>Danh sách tin</Link>
        <Link className="side-nav-link" to="/news/create"     style={menuStyle('/news/create')}     onClick={() => setSidebarOpen(false)}><IconPlus size={17}/>Gửi bài mới</Link>
        <Link className="side-nav-link" to="/news-digest"     style={menuStyle('/news-digest')}     onClick={() => setSidebarOpen(false)}><IconNewspaper size={17}/>Tổng hợp tin địa phương</Link>
        <Link className="side-nav-link" to="/chat"            style={menuStyle('/chat')}            onClick={() => setSidebarOpen(false)}><IconChat size={17}/>Tin nhắn</Link>
        <Link className="side-nav-link" to="/change-password" style={menuStyle('/change-password')} onClick={() => setSidebarOpen(false)}><IconKey size={17}/>Đổi mật khẩu</Link>

        {userObj && isAdminLevel && (
          <>
            <div style={{ padding: '14px 14px 4px', fontSize: '10.5px', color: 'var(--sidebar-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Hệ thống quản trị
            </div>
            <Link className="side-nav-link" to="/users" style={menuStyle('/users')} onClick={() => setSidebarOpen(false)}>
              <IconUsers size={17}/>Quản lý Nhân sự
            </Link>
          </>
        )}
      </div>

      {/* Theme + Đăng xuất */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--sidebar-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={toggleTheme}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', color: 'var(--sidebar-fg-muted)', fontSize: 13, cursor: 'pointer', padding: '8px 4px' }}
        >
          {isDarkMode ? <IconSun size={16} /> : <IconMoon size={16} />}
          {isDarkMode ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'var(--danger-soft)', border: 'none', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconLogout size={16} />Đăng xuất
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <style>{`
        @media (min-width: 769px) {
          .desktop-sidebar { display: flex !important; }
          .mobile-topbar   { display: none !important; }
          .mobile-drawer   { display: none !important; }
          .overlay         { display: none !important; }
          .main-content    { padding: 28px !important; padding-top: calc(env(safe-area-inset-top, 0px) + 28px) !important; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar   { display: flex !important; }
          .main-content    { padding: 16px !important; padding-top: 108px !important; }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="desktop-sidebar" style={{ width: '260px', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)', padding: '18px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <SidebarContent />
      </div>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background:    'var(--sidebar-bg)',
        paddingTop:    'env(safe-area-inset-top, 40px)',
        paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px',
        alignItems:    'center', justifyContent: 'space-between',
        boxShadow:     'var(--shadow-md)'
      }}>
        <button onClick={() => setSidebarOpen(true)} aria-label="Mở menu" style={{ ...chipStyle, width: 40, height: 40 }}>
          <IconMenu size={20} />
        </button>

        <span style={{ color: 'var(--sidebar-fg)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em' }}>
          QUẢN LÝ TIN
        </span>

        <div style={{ display: 'flex', gap: 5 }}>
          {isAdminStrict && <ErrorBell />}
          <ChatBell />
          <NotifBtn />
          <button onClick={handleRefresh} aria-label="Tải lại trang" style={{ ...chipStyle, width: 40, height: 40 }}>
            <IconRefresh size={18} />
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
      )}

      <div className="mobile-drawer" style={{ display: sidebarOpen ? 'flex' : 'none', position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)', padding: '18px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)', flexDirection: 'column', zIndex: 200, overflowY: 'auto' }}>
        <button onClick={() => setSidebarOpen(false)} aria-label="Đóng menu" style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'var(--sidebar-fg)', marginBottom: '10px', cursor: 'pointer' }}>
          <IconX size={20} />
        </button>
        <SidebarContent />
      </div>

      <div className="main-content" style={{ flex: 1, background: 'var(--bg)', padding: '28px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14 }}>Xin chào, <strong style={{ color: 'var(--accent)' }}>{userObj?.fullName || userObj?.FullName}</strong></div>
          <span style={{ fontSize: '12px', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '999px', fontWeight: 600 }}>{userObj?.role || userObj?.Role}</span>
        </div>

        {!hasEmail && location.pathname !== '/change-password' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: 'var(--warning-soft)', border: '1px solid var(--warning)', color: 'var(--warning)',
            padding: '11px 16px', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13.5
          }}>
            <IconMail size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Bạn chưa có email khôi phục mật khẩu — nếu quên mật khẩu sẽ không tự lấy lại được.</span>
            <button
              onClick={() => navigate('/change-password')}
              style={{ background: 'var(--warning)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              Cập nhật ngay
            </button>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
};

const IconFileBrand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-3 3.5Z"/>
  </svg>
);

export default MainLayout;
