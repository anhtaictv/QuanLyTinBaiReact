import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './views/Login';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import MainLayout from './layout/MainLayout';
import LoadingState from './components/LoadingState';

// Các trang sau chỉ tải khi vào đúng route (giảm bundle ban đầu)
const Dashboard       = lazy(() => import('./views/Dashboard'));
const NewsList        = lazy(() => import('./views/NewsList'));
const NewsForm        = lazy(() => import('./views/NewsForm'));
const UserManagement  = lazy(() => import('./views/UserManagement'));
const PostDetail      = lazy(() => import('./views/PostDetail'));
const Permissions     = lazy(() => import('./views/Permissions'));
const ChangePassword  = lazy(() => import('./views/ChangePassword'));
const DocEditor       = lazy(() => import('./views/DocEditor'));
const Chat            = lazy(() => import('./views/Chat'));
const NewsDigest      = lazy(() => import('./views/NewsDigest'));
const AIKnowledge     = lazy(() => import('./views/AIKnowledge'));
const AiAssistant     = lazy(() => import('./views/AiAssistant'));

// 1. Component bảo vệ Đăng nhập: Chưa đăng nhập thì không cho vào App
const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

// 2. Component bảo vệ quyền Admin: Chỉ Admin/Trưởng ban mới được vào các trang nhạy cảm
const AdminRoute = () => {
  const userObj = JSON.parse(localStorage.getItem('user'));
  const allowedAdminRoles = ['Admin', 'admin', 'Trưởng ban', 'Thư ký'];
  const userRole = userObj?.role || userObj?.Role;

  if (!allowedAdminRoles.includes(userRole)) {
    alert("Bạn không có quyền truy cập khu vực quản trị!");
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

// Trước đây SW chỉ được đăng ký lúc user bật push notification (MainLayout.jsx), nên ai
// không bật push thì không có SW (không sao), nhưng ai đã bật thì kẹt mãi ở bản JS/CSS
// lúc SW cài lần đầu — sw.js giờ đã tự skipWaiting()/clientsClaim(), còn ở đây chỉ cần
// đăng ký ngay khi mở app (không đợi user bật push) + tự reload 1 lần khi SW mới nắm
// quyền, để bản deploy mới tới tay user mà không cần họ đóng hết tab thủ công.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js');

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <Router>
      <Suspense fallback={<LoadingState label="Đang tải trang..." padding={80} />}>
        <Routes>
          {/* Route Đăng nhập - Đứng độc lập không có Sidebar */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* CẤP ĐỘ 1: Bắt buộc phải đăng nhập (Có Token) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>

              {/* Mặc định khi vào trang chủ sẽ đẩy sang Dashboard */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Các trang dành cho nhân viên thường (CTV, Người duyệt...) */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="news" element={<NewsList />} />
              <Route path="news/create" element={<NewsForm />} />
              <Route path="news/:id" element={<PostDetail />} />
              <Route path="news-digest" element={<NewsDigest />} />
              <Route path="ai-assistant" element={<AiAssistant />} />

              {/* ✅ SỬA: dùng :postId để khớp với useParams() trong DocEditor.jsx */}
              <Route path="doc-editor/:postId" element={<DocEditor />} />

              <Route path="change-password" element={<ChangePassword />} />
              <Route path="chat" element={<Chat />} />
              <Route path="chat/:conversationId" element={<Chat />} />

              {/* CẤP ĐỘ 2: Chỉ dành riêng cho quyền Admin/Cấp cao */}
              <Route element={<AdminRoute />}>
                <Route path="users" element={<UserManagement />} />
                <Route path="permissions" element={<Permissions />} />
                <Route path="ai-knowledge" element={<AIKnowledge />} />
              </Route>

            </Route>
          </Route>

          {/* Route dự phòng: Nếu gõ bừa đường dẫn sẽ tự về Dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
