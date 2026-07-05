import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { showToastSuccess } from '../utils/Toast';
import { IconPlus, IconAlertCircle, IconFolder, IconX, IconSend, IconLoader } from '../components/icons';

const NewsForm = () => {
  const navigate    = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user')) || {};

  const categories = [
    { id: 0, name: 'Chưa phân loại' },
    { id: 1, name: 'ANTT' },
    { id: 2, name: 'AN247' },
    { id: 3, name: 'Kinh tế' },
    { id: 4, name: 'Xã hội' }
  ];

  const [categoryId, setCategoryId] = useState(0);
  const [formData,   setFormData]   = useState({
    tieuDe:  '',
    sapo:    '',
    noiDung: ''
  });
  const [file,       setFile]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.tieuDe.trim()) {
      setError('Vui lòng nhập Tiêu đề bài viết!');
      return;
    }
    if (!file) {
      setError('Vui lòng đính kèm file Word (.docx)!');
      return;
    }

    setSubmitting(true);
    try {
      // Bước 1: Upload file
      const fileFormData = new FormData();
      fileFormData.append('file', file);
      const uploadRes = await api.post('/file/upload', fileFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const storedPath = uploadRes.data.storedPath;

      // Bước 2: Tạo bài – dùng đúng field name backend expect
      await api.post('/news', {
        tieuDe:      formData.tieuDe,
        sapo:        formData.sapo,
        noiDung:     formData.noiDung,
        kieu:        categories.find(c => c.id === parseInt(categoryId))?.name || 'Tin',
        ten:         currentUser.FullName || currentUser.fullName || '',
        hinhAnh:     '',
        Category:    parseInt(categoryId),
        StoragePath: storedPath,
        StatusID:    1
      });

      showToastSuccess('Đã gửi bài lên hệ thống thành công!');
      navigate('/news');
    } catch (err) {
      setError('Lỗi khi gửi bài: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle    = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', fontSize: 14 };
  const textareaStyle = { ...inputStyle, fontFamily: 'inherit', resize: 'vertical' };
  const labelStyle    = { display: 'block', marginBottom: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--text)' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', maxWidth: 800, margin: '0 auto' }}>

      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 22 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}><IconPlus size={18} style={{ color: 'var(--accent)' }} />Gửi Bài Mới</h3>
        <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: 13 }}>
          Điền thông tin và đính kèm file Word. Người duyệt sẽ chỉnh sửa trực tiếp trên file.
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, color: 'var(--danger)', background: 'var(--danger-soft)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13.5 }}>
          <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Chuyên mục */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Chuyên mục</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={inputStyle}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Tiêu đề */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tiêu đề bài viết <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            type="text" name="tieuDe"
            value={formData.tieuDe}
            onChange={handleInputChange}
            style={{ ...inputStyle, fontWeight: 600 }}
            placeholder="Nhập tiêu đề bài viết..."
            required
          />
        </div>

        {/* Sapo */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Sapo / Lời dẫn</label>
          <textarea
            name="sapo" value={formData.sapo}
            onChange={handleInputChange}
            rows={3} style={textareaStyle}
            placeholder="Nhập lời dẫn ngắn gọn..."
          />
        </div>

        {/* Nội dung */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Nội dung tóm tắt</label>
          <textarea
            name="noiDung" value={formData.noiDung}
            onChange={handleInputChange}
            rows={6} style={{ ...textareaStyle, lineHeight: '1.6' }}
            placeholder="Mô tả ngắn nội dung bài viết..."
          />
        </div>

        {/* Upload file */}
        <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label style={labelStyle}>
            File Word đính kèm <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="file" accept=".doc,.docx"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ ...inputStyle, border: '2px dashed var(--border)', background: 'var(--surface-2)', padding: 12 }}
            required
          />
          {file && (
            <small style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <IconFolder size={14} />Đã chọn: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
            </small>
          )}
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            Chỉ chấp nhận file .doc và .docx
          </small>
        </div>

        {/* Nút */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button" onClick={() => navigate('/news')}
            style={{ background: 'var(--surface-2)', color: 'var(--text)', padding: '12px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <IconX size={15} />Hủy
          </button>
          <button
            type="submit" disabled={submitting}
            style={{ background: submitting ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)', padding: 12, border: 'none', borderRadius: 'var(--radius-sm)', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, flex: 1, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {submitting ? <><IconLoader size={16} />Đang upload và gửi bài...</> : <><IconSend size={15} />Gửi Bài Lên Hệ Thống</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewsForm;
