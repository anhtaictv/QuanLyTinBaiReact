import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';
import {
  IconCloudUpload, IconAlertTriangle, IconRefresh, IconArrowLeft, IconCheckCircle,
  IconFileText, IconExternalLink, IconEdit, IconInfo, IconList, IconLoader
} from '../components/icons';

const DocEditor = () => {
  const { postId }  = useParams();
  const navigate    = useNavigate();

  const [driveFileId, setDriveFileId] = useState('');
  const [editUrl,     setEditUrl]     = useState('');
  const [storagePath, setStoragePath] = useState(''); // để ghi đè đúng file
  const [postTitle,   setPostTitle]   = useState('');
  const [status,      setStatus]      = useState('loading'); // loading | ready | completing | done | error
  const [errorMsg,    setErrorMsg]    = useState('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [elapsed,     setElapsed]     = useState(0);

  // ── 1. Khi mở → fetch bài viết → upload lên Drive ─────────────────────────
  useEffect(() => {
    if (!postId) { setErrorMsg('Không tìm thấy ID bài viết!'); setStatus('error'); return; }
    uploadToDrive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Đồng hồ đếm giây ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const uploadToDrive = async () => {
    setStatus('loading');
    try {
      // Lấy thông tin bài viết
      const res   = await api.get('/news');
      const found = res.data.find(p => (p.PostID || p.postID) === parseInt(postId));
      if (!found) { setErrorMsg('Không tìm thấy bài viết!'); setStatus('error'); return; }

      const sp = found.StoragePath || found.storagePath;
      if (!sp) { setErrorMsg('Bài viết chưa có file Word đính kèm!'); setStatus('error'); return; }

      setPostTitle(found.Title || found.title || `Bài #${postId}`);
      setStoragePath(sp);

      // Upload lên Drive
      const driveRes = await api.post('/drive/upload', {
        postId:      parseInt(postId),
        storagePath: sp,
        fileName:    (found.Title || 'TaiLieu').replace(/[/\\?%*:|"<>]/g, '').trim()
      });

      if (!driveRes.data?.driveFileId) { setErrorMsg('Không nhận được link Google Docs từ server!'); setStatus('error'); return; }

      setDriveFileId(driveRes.data.driveFileId);
      setEditUrl(driveRes.data.editUrl);
      setStatus('ready');

    } catch (err) {
      setErrorMsg('Lỗi upload Drive: ' + (err.response?.data?.error || err.message));
      setStatus('error');
    }
  };

  // ── 3. Hoàn thành → export về VPS, ghi đè file cũ ────────────────────────
  const handleComplete = useCallback(async () => {
    if (!driveFileId || !storagePath) return;

    if (!window.confirm('Xác nhận hoàn thành?\n\nFile đã chỉnh sửa sẽ ghi đè file gốc của CTV và bài viết được đổi sang trạng thái Đã duyệt.')) return;

    setStatus('completing');
    try {
      await api.post(`/drive/complete/${driveFileId}`, {
        postId:      parseInt(postId),
        storagePath  // để backend ghi đè đúng file
      });

      showToastSuccess('Đã lưu file về hệ thống và duyệt bài thành công!');
      setStatus('done');

    } catch (err) {
      showToastError('Lỗi lưu file: ' + (err.response?.data?.error || err.message));
      setStatus('ready');
    }
  }, [driveFileId, storagePath, postId]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const btnStyle = (bg, disabled = false, color) => ({
    background: disabled ? 'var(--text-muted)' : bg, color: color || 'white', border: 'none',
    padding: '9px 16px', borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7
  });

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16 }}>
      <IconCloudUpload size={44} style={{ color: 'var(--accent)' }} />
      <h3 style={{ fontSize: 17 }}>Đang upload file lên Google Drive...</h3>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Quá trình này mất khoảng 5-15 giây, vui lòng chờ</p>
    </div>
  );

  // ── LỖI ───────────────────────────────────────────────────────────────────
  if (status === 'error') return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 30 }}>
      <IconAlertTriangle size={44} style={{ color: 'var(--danger)', marginBottom: 12 }} />
      <h3 style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 18 }}>Không thể mở trình chỉnh sửa</h3>
      <p style={{ background: 'var(--danger-soft)', padding: 14, borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text)' }}>{errorMsg}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
        <button onClick={() => navigate(`/news/${postId}`)} style={btnStyle('var(--surface-2)', false, 'var(--text)')}><IconArrowLeft size={14} />Quay lại</button>
        <button onClick={uploadToDrive}                     style={btnStyle('var(--accent)')}><IconRefresh size={14} />Thử lại</button>
      </div>
    </div>
  );

  // ── HOÀN THÀNH ────────────────────────────────────────────────────────────
  if (status === 'done') return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 30 }}>
      <IconCheckCircle size={56} style={{ color: 'var(--success)', marginBottom: 12 }} />
      <h3 style={{ color: 'var(--success)', marginBottom: 8, fontSize: 18 }}>Đã lưu và duyệt bài thành công!</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        File đã ghi đè bản cũ của CTV. Bài viết được chuyển sang trạng thái <strong>Đã duyệt</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => navigate(`/news/${postId}`)} style={btnStyle('var(--accent)')}><IconFileText size={14} />Xem bài viết</button>
        <button onClick={() => navigate('/news')}           style={btnStyle('var(--surface-2)', false, 'var(--text)')}><IconList size={14} />Danh sách tin</button>
      </div>
    </div>
  );

  // ── EDITOR CHÍNH ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>

      {/* Thanh trên */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>

        {/* Trái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/news/${postId}`)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--sidebar-fg)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconArrowLeft size={14} />Quay lại
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><IconEdit size={14} />Chỉnh sửa tài liệu</div>
            <div style={{ fontSize: 12, color: 'var(--sidebar-fg-muted)', marginTop: 2 }}>{postTitle}</div>
          </div>
        </div>

        {/* Giữa: trạng thái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: iframeLoaded ? '#8FCBA8' : '#E0B15A' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: iframeLoaded ? 'var(--success)' : 'var(--warning)' }} />
            {iframeLoaded ? 'Google Docs sẵn sàng' : 'Đang tải...'}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--sidebar-fg-muted)', background: 'rgba(0,0,0,0.25)', padding: '4px 10px', borderRadius: 12 }}>
            {fmt(elapsed)}
          </div>
        </div>

        {/* Phải: nút */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.open(editUrl, '_blank')} style={btnStyle('rgba(255,255,255,0.08)')}>
            <IconExternalLink size={14} />Mở tab mới
          </button>
          <button onClick={handleComplete} disabled={status === 'completing'} style={btnStyle('var(--success)', status === 'completing')}>
            {status === 'completing' ? <><IconLoader size={14} />Đang lưu...</> : <><IconCheckCircle size={14} />Hoàn thành &amp; Duyệt bài</>}
          </button>
        </div>
      </div>

      {/* Nhắc nhở idle > 30 phút */}
      {elapsed > 1800 && status === 'ready' && (
        <div style={{ background: 'var(--danger-soft)', padding: '8px 20px', fontSize: 13, color: 'var(--danger)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconAlertTriangle size={14} />Bạn đã chỉnh sửa hơn 30 phút. Nhớ bấm <strong>&nbsp;Hoàn thành &amp; Duyệt bài&nbsp;</strong> trước khi đóng!</span>
          <button onClick={handleComplete} style={{ ...btnStyle('var(--danger)'), padding: '4px 12px', fontSize: 12 }}>Lưu ngay</button>
        </div>
      )}

      {/* Iframe Google Docs */}
      <div style={{ flex: 1, position: 'relative', background: 'var(--surface-2)' }}>
        {!iframeLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 10, gap: 10 }}>
            <IconFileText size={36} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text)', fontSize: 14, margin: 0 }}>Đang tải Google Docs...</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Nếu không hiện, bấm <strong>"Mở tab mới"</strong> ở trên</p>
          </div>
        )}
        <iframe
          src={editUrl}
          title="Google Docs Editor"
          width="100%" height="100%"
          style={{ border: 'none', display: 'block' }}
          onLoad={() => setIframeLoaded(true)}
          allow="clipboard-read; clipboard-write"
        />
      </div>

      {/* Hướng dẫn dưới */}
      <div style={{ background: 'var(--surface-2)', padding: '8px 20px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 20, flexShrink: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconInfo size={13} />Google Docs tự động lưu khi bạn gõ.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconCheckCircle size={13} />Bấm <strong>"Hoàn thành &amp; Duyệt bài"</strong> để lưu file về VPS và duyệt bài cho CTV.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconExternalLink size={13} />Nếu iframe bị chặn, dùng <strong>"Mở tab mới"</strong>.</span>
      </div>
    </div>
  );
};

export default DocEditor;
