import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';
import {
  IconFileText, IconDownload, IconEdit, IconSettings, IconArrowLeft,
  IconFolder, IconAlertCircle, IconCheckCircle, IconXCircle, IconClock
} from '../components/icons';
import LoadingState from '../components/LoadingState';

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
      showToastSuccess('Tải file thành công!');
    } catch { showToastError('Lỗi khi tải file!'); }
  };

  // ── PHÊ DUYỆT ─────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    try {
      await api.put(`/news/${id}/status`, { status: 2 });
      showToastSuccess('Đã phê duyệt!');
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

  if (!post) return <LoadingState label="Đang tải bài viết..." />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}><IconFileText size={18} style={{ color: 'var(--accent)' }} />Chi tiết Bài viết</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasFile && (
            <button onClick={handleDownloadFile} style={btn('var(--success)')}>
              <IconDownload size={14} />Tải File Word
            </button>
          )}
          {canEdit && hasFile && (
            <button onClick={() => navigate(`/doc-editor/${id}`)} style={btn('var(--accent)')}>
              <IconEdit size={14} />Chỉnh sửa Google Docs
            </button>
          )}
        </div>
      </div>

      {/* ── META ── */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong>Trạng thái:</strong> <StatusInline status={statusID} />
        </span>
        {post.AuthorName && <span><strong>Tác giả:</strong> {post.AuthorName}</span>}
        {post.CreatedAt  && (
          <span className="mono">
            <strong style={{ fontFamily: 'var(--font-body)' }}>Ngày gửi:</strong>{' '}
            {new Date(post.CreatedAt).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      {/* ── 3 TRƯỜNG NỘI DUNG ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>

        {/* Tiêu đề */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Tiêu đề</div>
          <div style={{ padding: '10px 14px', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontWeight: 700, color: 'var(--text)', fontSize: 16, lineHeight: '1.5' }}>
            {tieuDe || <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Không có tiêu đề</em>}
          </div>
        </div>

        {/* Sapo */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Sapo / Lời dẫn</div>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text)', minHeight: 50 }}>
            {sapo || <em style={{ color: 'var(--text-muted)' }}>Không có sapo</em>}
          </div>
        </div>

        {/* Nội dung */}
        <div>
          <div style={lbl}>Nội dung</div>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text)', minHeight: 80 }}>
            {noiDung || <em style={{ color: 'var(--text-muted)' }}>Không có nội dung</em>}
          </div>
        </div>
      </div>

      {/* ── FILE ĐÍNH KÈM ── */}
      {hasFile ? (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconFolder size={14} />Có file Word đính kèm trên hệ thống
            {statusID === 2 && <strong>&nbsp;· Đã được người duyệt chỉnh sửa</strong>}
          </span>
          <button onClick={handleDownloadFile} style={btn('var(--success)')}><IconDownload size={14} />Tải về</button>
        </div>
      ) : (
        <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAlertCircle size={14} />Chưa có file Word đính kèm
        </div>
      )}

      {/* ── KHU VỰC PHÊ DUYỆT ── */}
      {canEdit && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><IconSettings size={16} style={{ color: 'var(--text-muted)' }} />Thao tác phê duyệt</h3>

          {/* Nút duyệt/từ chối */}
          {statusID === 1 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={handleApprove} style={btn('var(--success)')}><IconCheckCircle size={14} />Duyệt Thông Qua</button>
              <button onClick={handleReject}  style={btn('var(--warning)')}><IconXCircle size={14} />Từ Chối</button>
            </div>
          )}

          {/* Google Docs box */}
          {hasFile ? (
            <div style={{ background: 'var(--accent-soft)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: 'var(--accent)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconEdit size={14} />Chỉnh sửa file Word qua Google Docs
              </p>
              <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Mở file trên Google Docs để chỉnh sửa giữ nguyên format. Sau khi bấm
                {' '}<strong>Hoàn thành &amp; Duyệt bài</strong>, file ghi đè bản cũ và bài tự động được duyệt.
              </p>
              <button onClick={() => navigate(`/doc-editor/${id}`)} style={btn('var(--accent)')}>
                <IconEdit size={14} />Mở Google Docs Editor
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconAlertCircle size={14} />CTV chưa upload file Word. Không thể chỉnh sửa qua Google Docs.
            </div>
          )}
        </div>
      )}

      {/* ── THÔNG BÁO CTV KHI ĐÃ DUYỆT ── */}
      {isCTV && statusID === 2 && hasFile && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px 0', color: 'var(--success)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheckCircle size={14} />Bài viết đã được duyệt và chỉnh sửa!
          </p>
          <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Người duyệt đã chỉnh sửa file Word của bạn. Tải về để xem bản hoàn chỉnh.
          </p>
          <button onClick={handleDownloadFile} style={btn('var(--success)')}>
            <IconDownload size={14} />Tải File Đã Chỉnh Sửa
          </button>
        </div>
      )}

      {/* ── QUAY LẠI ── */}
      <button onClick={() => navigate('/news')} style={btn('var(--surface-2)', 'var(--text)')}>
        <IconArrowLeft size={14} />Trở lại danh sách
      </button>
    </div>
  );
};

const StatusInline = ({ status }) => {
  const map = {
    2: { label: 'Đã duyệt', color: 'var(--success)', Icon: IconCheckCircle },
    3: { label: 'Từ chối', color: 'var(--danger)', Icon: IconXCircle },
  };
  const { label, color, Icon } = map[status] || { label: 'Chờ duyệt', color: 'var(--warning)', Icon: IconClock };
  return <span style={{ fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon size={14} />{label}</span>;
};

const lbl = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-mono)'
};
const btn = (bg, color) => ({
  background: bg, color: color || 'white', border: 'none',
  padding: '9px 15px', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 6
});

export default PostDetail;
