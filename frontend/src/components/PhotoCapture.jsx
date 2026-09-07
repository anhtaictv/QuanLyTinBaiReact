import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { IconImage, IconX, IconLoader } from './icons';

// Gửi nhanh ảnh hiện trường: capture="environment" ưu tiên mở camera sau trên mobile
// (giữ nguyên chọn từ thư viện ảnh vẫn hoạt động bình thường trên desktop). Upload dùng
// lại /api/file/upload sẵn có (đã mở rộng nhận ảnh ở fileRoutes.js) — không có endpoint
// riêng. AI đọc/mô tả ảnh CHƯA làm ở bản này — aiGatewayClient.chat() chỉ nhận text,
// model hiện tại (qwen2.5) không hỗ trợ vision.
const PhotoCapture = ({ photoPath, onUploaded, onRemove }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(''); // xem lại đúng tấm vừa chụp trước khi gửi bài

  // Ảnh chụp hiện trường qua điện thoại: cuộn phim/thư viện có thể trả nhầm tấm khác tấm
  // vừa bấm — chỉ hiện chữ "đã đính kèm" không đủ để phóng viên xác nhận đúng ảnh.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handlePick = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/file/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded(res.data.storedPath);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi upload ảnh');
      setPreviewUrl('');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl('');
    onRemove();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePick}
      />
      {photoPath ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 6, fontSize: 13 }}>
          {previewUrl
            ? <img src={previewUrl} alt="Ảnh hiện trường vừa chọn" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
            : <IconImage size={18} style={{ color: 'var(--text-muted)' }} />}
          Đã đính kèm ảnh hiện trường
          <button type="button" onClick={handleRemove} aria-label="Bỏ ảnh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><IconX size={13} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600 }}
        >
          {uploading ? <IconLoader size={13} /> : <IconImage size={13} />}
          {uploading ? 'Đang tải ảnh...' : 'Chụp/gửi ảnh hiện trường'}
        </button>
      )}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
};

export default PhotoCapture;
