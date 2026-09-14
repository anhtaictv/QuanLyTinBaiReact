// Đọc tài khoản đang đăng nhập từ localStorage. Có nơi lưu khoá 'role', nơi khác lưu
// 'Role' (tuỳ đợt code), nên gom về một chỗ thay vì mỗi màn hình tự đoán lại.
export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    // localStorage hỏng/không parse được thì coi như chưa đăng nhập, đừng để vỡ cả trang.
    return {};
  }
};

export const getCurrentRole = () => {
  const user = getCurrentUser();
  return String(user.role || user.Role || '').toLowerCase();
};

// Phải khớp ASSIGN_ROLES trong backend/routes/taskRoutes.js. Đây chỉ là lớp ẩn/hiện nút
// cho đỡ rối mắt — chặn thật vẫn nằm ở backend.
const ASSIGN_ROLES = ['admin', 'người duyệt', 'trưởng ban'];

export const canAssignTasks = () => ASSIGN_ROLES.includes(getCurrentRole());
