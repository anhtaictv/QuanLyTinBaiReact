import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';

const PostDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [post,    setPost]    = useState(null);
  const [tieuDe,  setTieuDe]  = useState('');
  const [sapo,    setSapo]    = useState('');
  const [noiDung, setNoiDung] = useState('');

  // ── FETCH + PARSE ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadPost = async () => {
      try {
        const res   = await api.get('/news');
        const found = res.data.find(p => (p.PostID || p.postID) === parseInt(id));
        if (!found) { showToastError('Không tìm thấy bài viết!'); return; }
        setPost(found);

        // Title luôn lấy từ cột Title
        setTieuDe(found.Title || found.title || '');

        // Parse Content – có thể là JSON cũ hoặc text thường
        const raw = found.Content || found.content || '';
        let parsedSapo    = '';
        let parsedNoiDung = '';

        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            parsedSapo    = obj.sapo    || obj.Sapo    || '';
            parsedNoiDung = obj.noiDung || obj.NoiDung || '';
          }
        } catch {
          // Không phải JSON → là text thường
          parsedNoiDung = raw;
        }

        // Summary ưu tiên hơn JSON sapo
        setSapo(found.Summary || found.summary || parsedSapo);
        setNoiDung(parsedNoiDung);

      } catch {
        showToastError('Không tải được thông tin bài viết!');
      }
    };
    loadPost();
  }, [id]);

  const currentUser = JSON.parse(localStorage.getItem('user')) || {};
  const userRole    = (currentUser?.role || currentUser?.Role || '').toLowerCase();
  const canEdit     = ['admin', 'người duyệt', 'trưởng ban', 'thư ký'].includes(userRole);
  const isCTV       = !canEdit;
  const hasFile     = !!(post?.StoragePath || post?.storagePath);
  const statusID    = post?.StatusID || post?.statusID;

  // ── TẢI FILE ──────────────────────────────────────────────────────────────
  const handleDownloadFile = async () => {
    const fp = post?.StoragePath || post?.storagePath;
    if (!fp) { showToastError('Không có file để tải!'); return; }
    try {
      const res  = await api.get(`/file/download?path=${encodeURIComponent(fp)}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${tieuDe || 'BaiViet'}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToastSuccess('✅ Tải file thành công!');
    } catch { showToastError('Lỗi khi tải file!'); }
  };

  // ── PHÊ DUYỆT ─────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    try {
      await api.put(`/news/${id}/status`, { status: 2 });
      showToastSuccess('✅ Đã phê duyệt!');
      setTimeout(() => navigate('/news'), 1000);
    } catch { showToastError('Lỗi khi phê duyệt!'); }
  };

  const handleReject = async () => {
    if (!window.confirm('Xác nhận từ chối bài này?')) return;
    try {
      await api.put(`/news/${id}/status`, { status: 3 });
      showToastSuccess('Đã từ chối!');
      setTimeout(() => navigate('/news'), 1000);
    } catch { showToastError('Lỗi khi từ chối!'); }
  };

  if (!post) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#7f8c8d' }}>
      Đang tải...
    </div>
  );

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: 12, marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ color: '#2c3e50', margin: 0 }}>📄 Chi tiết Bài viết</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasFile && (
            <button onClick={handleDownloadFile} style={btn('#27ae60')}>
              📥 Tải File Word
            </button>
          )}
          {canEdit && hasFile && (
            <button onClick={() => navigate(`/doc-editor/${id}`)} style={btn('#1a73e8')}>
              📝 Chỉnh sửa Google Docs
            </button>
          )}
        </div>
      </div>

      {/* ── META ── */}
      <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: 6, marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
        <span>
          <strong>Trạng thái:</strong>{' '}
          <span style={{ fontWeight: 'bold', color: statusID === 2 ? '#27ae60' : statusID === 1 ? '#e67e22' : '#e74c3c' }}>
            {statusID === 2 ? '✅ Đã duyệt' : statusID === 1 ? '⏳ Chờ duyệt' : '❌ Từ chối'}
          </span>
        </span>
        {post.AuthorName && <span><strong>Tác giả:</strong> {post.AuthorName}</span>}
        {post.CreatedAt  && (
          <span>
            <strong>Ngày gửi:</strong>{' '}
            {new Date(post.CreatedAt).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      {/* ── 3 TRƯỜNG NỘI DUNG ── */}
      <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>

        {/* Tiêu đề */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Tiêu đề</div>
          <div style={{ padding: '10px 14px', background: '#fff8f8', border: '1px solid #fdd', borderRadius: 6, fontWeight: 'bold', color: '#b30000', fontSize: 16, lineHeight: '1.5' }}>
            {tieuDe || <em style={{ color: '#aaa', fontWeight: 'normal' }}>Không có tiêu đề</em>}
          </div>
        </div>

        {/* Sapo */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Sapo / Lời dẫn</div>
          <div style={{ padding: '10px 14px', background: '#f8f9fa', border: '1px solid #eee', borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: '1.7', color: '#34495e', minHeight: 50 }}>
            {sapo || <em style={{ color: '#aaa' }}>Không có sapo</em>}
          </div>
        </div>

        {/* Nội dung */}
        <div>
          <div style={lbl}>Nội dung</div>
          <div style={{ padding: '10px 14px', background: '#f8f9fa', border: '1px solid #eee', borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: '1.7', color: '#34495e', minHeight: 80 }}>
            {noiDung || <em style={{ color: '#aaa' }}>Không có nội dung</em>}
          </div>
        </div>
      </div>

      {/* ── FILE ĐÍNH KÈM ── */}
      {hasFile ? (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#2e7d32' }}>
            📁 Có file Word đính kèm trên hệ thống
            {statusID === 2 && <strong> · Đã được người duyệt chỉnh sửa</strong>}
          </span>
          <button onClick={handleDownloadFile} style={btn('#2e7d32')}>📥 Tải về</button>
        </div>
      ) : (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#795548' }}>
          ⚠️ Chưa có file Word đính kèm
        </div>
      )}

      {/* ── KHU VỰC PHÊ DUYỆT ── */}
      {canEdit && (
        <div style={{ borderTop: '2px solid #eee', paddingTop: 20, marginBottom: 20 }}>
          <h3 style={{ color: '#2c3e50', marginTop: 0, marginBottom: 16 }}>⚙️ Thao tác phê duyệt</h3>

          {/* Nút duyệt/từ chối */}
          {statusID === 1 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={handleApprove} style={btn('#27ae60')}>✅ Duyệt Thông Qua</button>
              <button onClick={handleReject}  style={btn('#e67e22')}>❌ Từ Chối</button>
            </div>
          )}

          {/* Google Docs box */}
          {hasFile ? (
            <div style={{ background: '#e8f4fd', padding: 16, borderRadius: 8, border: '1px solid #90caf9' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#1565c0', fontSize: 14 }}>
                📝 Chỉnh sửa file Word qua Google Docs
              </p>
              <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#555', lineHeight: '1.5' }}>
                Mở file trên Google Docs để chỉnh sửa giữ nguyên format. Sau khi bấm
                {' '}<strong>Hoàn thành & Duyệt bài</strong>, file ghi đè bản cũ và bài tự động được duyệt.
              </p>
              <button onClick={() => navigate(`/doc-editor/${id}`)} style={btn('#1a73e8')}>
                📝 Mở Google Docs Editor
              </button>
            </div>
          ) : (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#795548' }}>
              ⚠️ CTV chưa upload file Word. Không thể chỉnh sửa qua Google Docs.
            </div>
          )}
        </div>
      )}

      {/* ── THÔNG BÁO CTV KHI ĐÃ DUYỆT ── */}
      {isCTV && statusID === 2 && hasFile && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px 0', color: '#2e7d32', fontWeight: 'bold', fontSize: 14 }}>
            ✅ Bài viết đã được duyệt và chỉnh sửa!
          </p>
          <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#555' }}>
            Người duyệt đã chỉnh sửa file Word của bạn. Tải về để xem bản hoàn chỉnh.
          </p>
          <button onClick={handleDownloadFile} style={btn('#27ae60')}>
            📥 Tải File Đã Chỉnh Sửa
          </button>
        </div>
      )}

      {/* ── QUAY LẠI ── */}
      <button onClick={() => navigate('/news')} style={btn('#7f8c8d')}>
        ← Trở lại danh sách
      </button>
    </div>
  );
};

const lbl = {
  fontSize: 11, fontWeight: 'bold', color: '#7f8c8d',
  textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6
};
const btn = (bg) => ({
  background: bg, color: 'white', border: 'none',
  padding: '10px 16px', borderRadius: 6,
  cursor: 'pointer', fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap'
});

export default PostDetail;