import React, { useEffect, useState } from 'react';
import { listRagDocuments, ingestRagDocument, deleteRagDocument } from '../services/aiService';
import { showToastSuccess } from '../utils/Toast';
import { IconRobot, IconLoader, IconTrash, IconAlertCircle } from '../components/icons';

// Trang quản trị kho tri thức RAG (module 4): nạp văn bản quy định biên tập/luật báo
// chí bằng cách dán tiêu đề + nội dung (chunk + embed qua Ollama), dùng cho AIBell
// hỏi-đáp. Chỉ admin/trưởng ban/thư ký vào được (khớp AdminRoute trong App.jsx và
// requireRoles ở backend routes/aiRoutes.js).
const AIKnowledge = () => {
  const [documents, setDocuments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchDocs = async () => {
    setLoadingList(true);
    try {
      const { data } = await listRagDocuments();
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleIngest = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !content.trim()) {
      setError('Nhập đủ tiêu đề và nội dung văn bản.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await ingestRagDocument(title.trim(), content);
      showToastSuccess(`Đã nạp "${title}" (${data.chunkCount} đoạn) vào kho tri thức.`);
      setTitle('');
      setContent('');
      fetchDocs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sourceId, docTitle) => {
    try {
      await deleteRagDocument(sourceId);
      showToastSuccess(`Đã xóa "${docTitle}" khỏi kho tri thức.`);
      fetchDocs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const inputStyle    = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', fontSize: 14 };
  const textareaStyle = { ...inputStyle, fontFamily: 'inherit', resize: 'vertical' };
  const labelStyle    = { display: 'block', marginBottom: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--text)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 22 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}><IconRobot size={18} style={{ color: 'var(--accent)' }} />Kho tri thức AI (RAG)</h3>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: 13 }}>
            Nạp văn bản quy định biên tập, luật báo chí, quy chế phát ngôn... để trợ lý AI (chuông góc trên) tra cứu và trả lời dựa trên đúng nội dung đã nạp.
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, color: 'var(--danger)', background: 'var(--danger-soft)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13.5 }}>
            <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
          </div>
        )}

        <form onSubmit={handleIngest}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tiêu đề văn bản</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="VD: Luật Báo chí 2016 - Điều 9" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nội dung</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} style={textareaStyle} placeholder="Dán nội dung văn bản quy định vào đây..." />
          </div>
          <button type="submit" disabled={submitting}
            style={{ background: submitting ? 'var(--text-muted)' : 'var(--accent)', color: 'var(--accent-fg)', padding: 12, border: 'none', borderRadius: 'var(--radius-sm)', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
            {submitting ? <><IconLoader size={16} />Đang nạp và tạo embedding...</> : 'Nạp vào kho tri thức'}
          </button>
        </form>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <h4 style={{ fontSize: 15, marginBottom: 14 }}>Văn bản đã nạp ({documents.length})</h4>
        {loadingList ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}><IconLoader size={14} /> Đang tải...</div>
        ) : documents.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chưa có văn bản nào được nạp.</div>
        ) : (
          documents.map(doc => (
            <div key={doc.sourceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{doc.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doc.chunkCount} đoạn · nạp lúc {new Date(doc.createdAt).toLocaleString('vi-VN')}</div>
              </div>
              <button onClick={() => handleDelete(doc.sourceId, doc.title)} title="Xóa"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: 8, cursor: 'pointer', display: 'flex' }}>
                <IconTrash size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIKnowledge;
