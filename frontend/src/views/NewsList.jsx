import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const NewsList = () => {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
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
      const [postsRes, usersRes] = await Promise.all([
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

      const usersData = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.recordset || []);
      setUsers(usersData);

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

  if (loading) return <div style={{ padding: '20px' }}>Đang tải dữ liệu từ VPS...</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>📰 Quản lý Tin Bài</h2>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            onClick={() => setFilter('all')} 
            style={{ padding: '8px 16px', background: filter === 'all' ? '#1a73e8' : '#ddd', color: filter === 'all' ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          > Tất cả </button>
          <button 
            onClick={() => setFilter('pending')} 
            style={{ padding: '8px 16px', background: filter === 'pending' ? '#f39c12' : '#ddd', color: filter === 'pending' ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          > Chờ duyệt </button>
        </div>
      </div>

      {/* THANH TÌM KIẾM & LỌC NGÀY THÁNG */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
        <input 
          placeholder="🔍 Tìm tiêu đề, tác giả hoặc nội dung kịch bản..." 
          style={{ padding: '10px', flex: '2 1 300px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '5px', flex: '1 1 300px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Từ:</span>
          <input 
            type="date" 
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd', flex: 1 }}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
          />
          <span style={{ fontSize: '12px', color: '#666' }}>Đến:</span>
          <input 
            type="date" 
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd', flex: 1 }}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
          />
        </div>
      </div>
      
      {/* KHU VỰC BẢNG HIỂN THỊ */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Tiêu đề</th>
              <th style={{ padding: '12px' }}>Tác giả</th>
              <th style={{ padding: '12px' }}>Trạng thái</th>
              <th style={{ padding: '12px' }}>Thao tác</th>
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
                  <tr key={pID} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={{ padding: '12px' }}>#{pID}</td>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      <span onClick={() => navigate(`/news/${pID}`)} style={{ color: '#1a73e8', cursor: 'pointer' }}> {pTitle} </span>
                    </td>
                    <td style={{ padding: '12px' }}>👤 {authorName}</td>
                    <td style={{ padding: '12px' }}>
                      {pStatus === 2 ? <span style={{ color: 'green' }}>✅ Đã duyệt</span> : 
                       pStatus === 3 ? <span style={{ color: 'red' }}>❌ Từ chối</span> : 
                       <span style={{ color: 'orange' }}>⏳ Chờ duyệt</span>}
                      {pLocked && <span title="Bài viết đang bị khóa"> 🔒</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {canApproveOrReject && (pStatus === 1 || pStatus === 0) && (
                        <>
                          <button onClick={() => handleApprove(pID)} style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '5px', cursor: 'pointer' }}> Duyệt </button>
                          <button onClick={() => handleReject(pID)} style={{ background: '#e67e22', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '5px', cursor: 'pointer' }}> Từ chối </button>
                        </>
                      )}
                      {canLockOrUnlock && (
                        <button onClick={() => handleLock(pID, pLocked)} style={{ background: pLocked ? '#95a5a6' : '#34495e', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '5px', cursor: 'pointer' }}>
                          {pLocked ? '🔓 Mở' : '🔒 Khóa'}
                        </button>
                      )}
                      {canDeletePost && (
                        <button onClick={() => handleDelete(pID, pTitle)} style={{ background: '#ff4d4f', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Xóa</button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
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

export default NewsList;