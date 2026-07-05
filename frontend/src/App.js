import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Import các trang chức năng
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import NewsList from './views/NewsList';
import NewsForm from './views/NewsForm';
import UserManagement from './views/UserManagement';
import PostDetail from './views/PostDetail';
import MainLayout from './layout/MainLayout';
import Permissions from './views/Permissions';
import ChangePassword from './views/ChangePassword';
import DocEditor from './views/DocEditor';
import Chat from './views/Chat';

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

function App() {
  return (
    <Router>
      <Routes>
        {/* Route Đăng nhập - Đứng độc lập không có Sidebar */}
        <Route path="/login" element={<Login />} />

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

            {/* ✅ SỬA: dùng :postId để khớp với useParams() trong DocEditor.jsx */}
            <Route path="doc-editor/:postId" element={<DocEditor />} />

            <Route path="change-password" element={<ChangePassword />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:conversationId" element={<Chat />} />

            {/* CẤP ĐỘ 2: Chỉ dành riêng cho quyền Admin/Cấp cao */}
            <Route element={<AdminRoute />}>
              <Route path="users" element={<UserManagement />} />
              <Route path="permissions" element={<Permissions />} />
            </Route>

          </Route>
        </Route>

        {/* Route dự phòng: Nếu gõ bừa đường dẫn sẽ tự về Dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;