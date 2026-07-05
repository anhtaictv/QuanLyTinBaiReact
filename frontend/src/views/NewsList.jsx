import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { IconSearch, IconUser, IconCheckCircle, IconXCircle, IconClock, IconLock, IconUnlock, IconTrash } from '../components/icons';
import LoadingState from '../components/LoadingState';

const NewsList = () => {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // --- CÁC STATE MỚI CHO BỘ LỌC NÂNG CAO ---
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const userRole = (currentUser?.role || currentUser?.Role || "").toLowerCase();

  // Định nghĩa quyền hạn
  const canApproveOrReject = ['admin', 'người duyệt', 'trưởng ban', 'thư ký'].includes(userRole);
  const canLockOrUnlock = ['admin', 'trưởng ban'].includes(userRole);
  const canDeletePost = ['admin'].includes(userRole);

  // Lấy dữ liệu từ VPS
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes] = await Promise.all([
        api.get('/news'),
        api.get('/users/basic')
      ]);

      // Chuẩn hóa dữ liệu từ SQL Server (recordset)
      let allData = Array.isArray(postsRes.data) ? postsRes.data : (postsRes.data.recordset || []);

      // Lọc theo tab Trạng thái (Pending / All)
      if (filter === 'pending') {
        const pending = allData.filter(p => {
          const s = p.StatusID !== undefined ? p.StatusID : p.statusID;
          return s === 1 || s === 0;
        });
        setPosts(pending);
      } else {
        setPosts(allData);
      }

    } catch (err) {
      console.error("Lỗi khi fetch dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- LOGIC LỌC NÂNG CAO (ĐÃ ĐƯỢC TÍCH HỢP TÌM KIẾM TRONG NỘI DUNG PHÂN CẢNH) ---
  const filteredPosts = posts.filter(p => {
    const titleMatch = (p.Title || p.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    const authorName = p.AuthorName || p.FullName || p.fullName || "";
    const authorMatch = authorName.toLowerCase().includes(searchTerm.toLowerCase());

    // Tìm kiếm thông minh: Cho phép người dùng gõ tìm từ khóa nằm trong nội dung chi tiết
    let contentMatch = false;
    try {
      // Nếu là kịch bản phân cảnh cấu trúc JSON mới
      const parsed = JSON.parse(p.Content || p.content);
      contentMatch = (parsed.noiDung || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                     (parsed.sapo || "").toLowerCase().includes(searchTerm.toLowerCase());
    } catch (e) {
      // Nếu là văn bản thô/HTML định dạng cũ
      contentMatch = (p.Content || p.content || "").toLowerCase().includes(searchTerm.toLowerCase());
    }

    // Xử lý bộ lọc ngày tháng phát hành bài viết
    const postDate = new Date(p.CreatedAt || p.createdAt);
    let dateMatch = true;

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      dateMatch = dateMatch && postDate >= startDate;
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      dateMatch = dateMatch && postDate <= endDate;
    }

    return (titleMatch || authorMatch || contentMatch) && dateMatch;
  });

  // Thao tác sửa đổi trạng thái bài viết
  const handleApprove = async (postId) => {
    try {
      await api.put(`/news/${postId}/status`, { status: 2 });
      alert("Đã phê duyệt thành công!");
      fetchData();
    } catch (err) { alert("Lỗi duyệt bài!"); }
  };

  const handleReject = async (postId) => {
    if (window.confirm("Xác nhận: Từ chối bài này?")) {
      try {
        await api.put(`/news/${postId}/status`, { status: 3 });
        alert("Đã từ chối bài!");
        fetchData();
      } catch (err) { alert("Lỗi từ chối!"); }
    }
  };

  const handleLock = async (postId, currentLockStatus) => {
    try {
      await api.post(`/news/${postId}/lock`, { lock: !currentLockStatus });
      fetchData();
    } catch (err) { alert("Lỗi khóa/mở bài!"); }
  };

  const handleDelete = async (postId, title) => {
    if (window.confirm(`Xác nhận: Bạn có chắc chắn muốn xóa bài viết "${title}"?`)) {
      try {
        await api.delete(`/news/${postId}`);
        alert("Đã xóa bài viết thành công!");
        fetchData();
      } catch (err) {
        console.error("Lỗi xóa bài:", err);
        alert("Không thể xóa bài viết. Lỗi: " + (err.response?.data?.error || "Lỗi kết nối"));
      }
    }
  };

  const filterBtnStyle = (active, activeColor) => ({
    padding: '8px 16px', background: active ? activeColor : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text)', border: 'none', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 13.5, fontWeight: 600
  });

  const actionBtnStyle = (bg, color) => ({
    background: bg, color: color || '#fff', border: 'none', padding: '6px 11px',
    borderRadius: 'var(--radius-sm)', marginRight: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 5
  });

  if (loading) return <LoadingState label="Đang tải dữ liệu…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: 22 }}>Quản lý Tin Bài</h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setFilter('all')} style={filterBtnStyle(filter === 'all', 'var(--accent)')}>Tất cả</button>
          <button onClick={() => setFilter('pending')} style={filterBtnStyle(filter === 'pending', 'var(--warning)')}>Chờ duyệt</button>
        </div>
      </div>

      {/* THANH TÌM KIẾM & LỌC NGÀY THÁNG */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
        <div style={{ position: 'relative', flex: '2 1 300px' }}>
          <IconSearch size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Tìm tiêu đề, tác giả hoặc nội dung kịch bản..."
            style={{ padding: '9px 12px 9px 36px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flex: '1 1 300px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Từ:</span>
          <input
            type="date"
            style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', flex: 1 }}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Đến:</span>
          <input
            type="date"
            style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', flex: 1 }}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      {/* KHU VỰC BẢNG HIỂN THỊ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>ID</th>
              <th style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Tiêu đề</th>
              <th style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Tác giả</th>
              <th style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Trạng thái</th>
              <th style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.length > 0 ? (
              filteredPosts.map(item => {
                const pID = item.PostID || item.postID;
                const pTitle = item.Title || item.title || "Không tiêu đề";
                const pStatus = item.StatusID !== undefined ? item.StatusID : item.statusID;
                const pLocked = item.IsLocked || item.isLocked;
                const authorName = item.AuthorName || item.FullName || item.fullName || `ID: ${item.AuthorID || item.authorID}`;

                return (
                  <tr key={pID} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="mono" style={{ padding: '12px', fontSize: 13, color: 'var(--text-muted)' }}>#{pID}</td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>
                      <span onClick={() => navigate(`/news/${pID}`)} style={{ color: 'var(--accent)', cursor: 'pointer' }}>{pTitle}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 13.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconUser size={14} />{authorName}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={pStatus} />
                      {pLocked && <IconLock size={13} style={{ marginLeft: 6, verticalAlign: 'middle', color: 'var(--text-muted)' }} />}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {canApproveOrReject && (pStatus === 1 || pStatus === 0) && (
                        <>
                          <button onClick={() => handleApprove(pID)} style={actionBtnStyle('var(--success)')}><IconCheckCircle size={13} />Duyệt</button>
                          <button onClick={() => handleReject(pID)} style={actionBtnStyle('var(--warning)')}><IconXCircle size={13} />Từ chối</button>
                        </>
                      )}
                      {canLockOrUnlock && (
                        <button onClick={() => handleLock(pID, pLocked)} style={actionBtnStyle(pLocked ? 'var(--surface-2)' : 'var(--sidebar-bg)', pLocked ? 'var(--text)' : '#fff')}>
                          {pLocked ? <IconUnlock size={13} /> : <IconLock size={13} />}{pLocked ? 'Mở' : 'Khóa'}
                        </button>
                      )}
                      {canDeletePost && (
                        <button onClick={() => handleDelete(pID, pTitle)} style={actionBtnStyle('var(--danger)')}><IconTrash size={13} />Xóa</button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Không tìm thấy bài viết nào khớp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    2: { label: 'Đã duyệt', color: 'var(--success)', bg: 'var(--success-soft)', Icon: IconCheckCircle },
    3: { label: 'Từ chối', color: 'var(--danger)', bg: 'var(--danger-soft)', Icon: IconXCircle },
  };
  const { label, color, bg, Icon } = map[status] || { label: 'Chờ duyệt', color: 'var(--warning)', bg: 'var(--warning-soft)', Icon: IconClock };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color, background: bg, padding: '3px 9px', borderRadius: 999 }}>
      <Icon size={12} />{label}
    </span>
  );
};

export default NewsList;
