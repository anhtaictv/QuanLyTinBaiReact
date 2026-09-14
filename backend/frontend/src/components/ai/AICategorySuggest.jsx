import React, { useState } from 'react';
import { categorizeContent } from '../../services/aiService';
import { IconSparkles, IconLoader } from '../icons';

// Gợi ý chuyên mục + trích xuất thực thể (người/địa danh/cơ quan) làm tag tham khảo.
// Không có cột Tags trong DB nên tag chỉ hiển thị để copy, không tự lưu.
const AICategorySuggest = ({ content, categories, onApplyCategory }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { category, tags }
  const [errorMsg, setErrorMsg] = useState('');

  const handleSuggest = async () => {
    if (!content || !content.trim()) {
      setErrorMsg('Nhập nội dung tóm tắt trước đã nhé.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setResult(null);
    try {
      const { data } = await categorizeContent(content);
      setResult(data);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const matchedCategory = result && categories.find(c => c.name === result.category);

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={handleSuggest} disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12,
          border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
        }}>
        {loading ? <IconLoader size={13} /> : <IconSparkles size={13} />}Gợi ý phân loại & tag (AI)
      </button>

      {errorMsg && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--danger)' }}>{errorMsg}</div>}

      {result && (
        <div style={{ marginTop: 8, fontSize: 12.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Gợi ý:</span>
          {matchedCategory ? (
            <button type="button" onClick={() => onApplyCategory(matchedCategory.id)}
              style={{ padding: '3px 9px', borderRadius: 999, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
              {result.category} — bấm để áp dụng
            </button>
          ) : (
            <span>{result.category}</span>
          )}
          {(result.tags || []).map((tag, i) => (
            <span key={i} style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {tag}
            </span>
          ))}
          {(result.tags || []).length === 0 && <span style={{ color: 'var(--text-muted)' }}>(không có tag nào)</span>}
        </div>
      )}
    </div>
  );
};

export default AICategorySuggest;
