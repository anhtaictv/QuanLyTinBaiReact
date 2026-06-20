import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { showToastSuccess, showToastError } from '../utils/Toast';

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

      showToastSuccess('✅ Đã lưu file về hệ thống và duyệt bài thành công!');
      setStatus('done');

    } catch (err) {
      showToastError('Lỗi lưu file: ' + (err.response?.data?.error || err.message));
      setStatus('ready');
    }
  }, [driveFileId, storagePath, postId]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const btnStyle = (bg, disabled = false) => ({
    background: disabled ? '#bdc3c7' : bg, color: 'white', border: 'none',
    padding: '9px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap'
  });

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16 }}>
      <div style={{ fontSize: 48 }}>☁️</div>
      <h3 style={{ margin: 0, color: '#2c3e50' }}>Đang upload file lên Google Drive...</h3>
      <p style={{ margin: 0, color: '#7f8c8d', fontSize: 13 }}>Quá trình này mất khoảng 5-15 giây, vui lòng chờ</p>
    </div>
  );

  // ── LỖI ───────────────────────────────────────────────────────────────────
  if (status === 'error') return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 30 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
      <h3 style={{ color: '#e74c3c', marginBottom: 12 }}>Không thể mở trình chỉnh sửa</h3>
      <p style={{ background: '#ffebee', padding: 14, borderRadius: 8, fontSize: 14, color: '#555' }}>{errorMsg}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
        <button onClick={() => navigate(`/news/${postId}`)} style={btnStyle('#7f8c8d')}>← Quay lại</button>
        <button onClick={uploadToDrive}                     style={btnStyle('#3498db')}>🔄 Thử lại</button>
      </div>
    </div>
  );

  // ── HOÀN THÀNH ────────────────────────────────────────────────────────────
  if (status === 'done') return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 30 }}>
      <div style={{ fontSize: 60, marginBottom: 12 }}>✅</div>
      <h3 style={{ color: '#27ae60', marginBottom: 8 }}>Đã lưu và duyệt bài thành công!</h3>
      <p style={{ color: '#7f8c8d', fontSize: 14, marginBottom: 24 }}>
        File đã ghi đè bản cũ của CTV. Bài viết được chuyển sang trạng thái <strong>Đã duyệt</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => navigate(`/news/${postId}`)} style={btnStyle('#2980b9')}>📄 Xem bài viết</button>
        <button onClick={() => navigate('/news')}           style={btnStyle('#7f8c8d')}>📰 Danh sách tin</button>
      </div>
    </div>
  );

  // ── EDITOR CHÍNH ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', fontFamily: 'Arial, sans-serif' }}>

      {/* Thanh trên */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#2c3e50', color: 'white', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>

        {/* Trái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/news/${postId}`)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
            ← Quay lại
          </button>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14 }}>📝 Chỉnh sửa tài liệu</div>
            <div style={{ fontSize: 12, color: '#95a5a6', marginTop: 2 }}>{postTitle}</div>
          </div>
        </div>

        {/* Giữa: trạng thái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: iframeLoaded ? '#2ecc71' : '#f39c12' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: iframeLoaded ? '#2ecc71' : '#f39c12' }} />
            {iframeLoaded ? 'Google Docs sẵn sàng' : 'Đang tải...'}
          </div>
          <div style={{ fontSize: 12, color: '#95a5a6', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 12 }}>
            ⏱ {fmt(elapsed)}
          </div>
        </div>

        {/* Phải: nút */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.open(editUrl, '_blank')} style={btnStyle('#34495e')}>
            🔗 Mở tab mới
          </button>
          <button onClick={handleComplete} disabled={status === 'completing'} style={btnStyle('#27ae60', status === 'completing')}>
            {status === 'completing' ? '⏳ Đang lưu...' : '✅ Hoàn thành & Duyệt bài'}
          </button>
        </div>
      </div>

      {/* Nhắc nhở idle > 30 phút */}
      {elapsed > 1800 && status === 'ready' && (
        <div style={{ background: '#ffebee', padding: '8px 20px', fontSize: 13, color: '#c62828', borderBottom: '1px solid #ef9a9a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Bạn đã chỉnh sửa hơn 30 phút. Nhớ bấm <strong>Hoàn thành & Duyệt bài</strong> trước khi đóng!</span>
          <button onClick={handleComplete} style={{ ...btnStyle('#c62828'), padding: '4px 12px', fontSize: 12 }}>Lưu ngay</button>
        </div>
      )}

      {/* Iframe Google Docs */}
      <div style={{ flex: 1, position: 'relative', background: '#f0f0f0' }}>
        {!iframeLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', zIndex: 10 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Đang tải Google Docs...</p>
            <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>Nếu không hiện, bấm <strong>"Mở tab mới"</strong> ở trên</p>
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
      <div style={{ background: '#ecf0f1', padding: '8px 20px', fontSize: 12, color: '#7f8c8d', display: 'flex', gap: 20, flexShrink: 0, borderTop: '1px solid #ddd', flexWrap: 'wrap' }}>
        <span>💡 Google Docs tự động lưu khi bạn gõ.</span>
        <span>✅ Bấm <strong>"Hoàn thành & Duyệt bài"</strong> để lưu file về VPS và duyệt bài cho CTV.</span>
        <span>🔗 Nếu iframe bị chặn, dùng <strong>"Mở tab mới"</strong>.</span>
      </div>
    </div>
  );
};

export default DocEditor;