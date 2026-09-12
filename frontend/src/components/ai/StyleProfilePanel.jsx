import React, { useState, useEffect } from 'react';
import { getMyStyleProfile, refreshMyStyleProfile, updateMyStyleProfile } from '../../services/aiService';
import { IconSparkles, IconLoader, IconRefresh, IconEdit, IconCheck, IconX, IconLock } from '../icons';

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer'
};
const textareaStyle = {
  width: '100%', minHeight: 140, padding: 8, fontSize: 12.5, fontFamily: 'inherit',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', resize: 'vertical', boxSizing: 'border-box'
};

// Hồ sơ văn phong cá nhân: AI tự tóm tắt từ các bài đã duyệt của chính người dùng, để
// proofread/gợi ý tiêu đề/sapo/trợ lý chat (aiController.js: withStyleProfile) giữ giọng
// văn quen thuộc của họ thay vì luôn ra một văn phong chung chung. Cập nhật tự động định
// kỳ (scripts/update-style-profiles.js qua Windows Task Scheduler). Người dùng cũng tự sửa
// tay được ("Sửa") — sửa tay sẽ khoá hồ sơ (locked), đợt auto định kỳ tiếp theo sẽ bỏ qua
// người này để không âm thầm ghi đè mất bản họ vừa chỉnh; bấm "Cập nhật ngay" mới cho AI
// viết lại và mở khoá trở lại.
const StyleProfilePanel = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMyStyleProfile().then(res => setProfile(res.data)).catch(() => setProfile(null)).finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const { data } = await refreshMyStyleProfile();
      setProfile(prev => ({ ...prev, profileText: data.profileText, sourcePostCount: data.sourcePostCount, locked: false }));
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Không cập nhật được hồ sơ văn phong.');
    } finally {
      setRefreshing(false);
    }
  };

  const startEdit = () => {
    setDraft(profile?.profileText || '');
    setError('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!draft.trim()) return setError('Nội dung hồ sơ không được để trống.');
    setSaving(true);
    setError('');
    try {
      const { data } = await updateMyStyleProfile(draft.trim());
      setProfile(prev => ({ ...prev, profileText: data.profileText, locked: true }));
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được hồ sơ văn phong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ marginBottom: 16, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
          <IconSparkles size={14} />HỒ SƠ VĂN PHONG CỦA BẠN
          {profile?.locked && (
            <span title="Đã sửa tay — auto cập nhật định kỳ sẽ bỏ qua, không ghi đè." style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600, color: 'var(--text-muted)' }}>
              <IconLock size={11} />đã khoá
            </span>
          )}
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            {profile?.profileText && (
              <button type="button" style={btnStyle} disabled={refreshing || saving} onClick={startEdit}>
                <IconEdit size={12} />Sửa
              </button>
            )}
            <button type="button" style={btnStyle} disabled={refreshing || saving} onClick={handleRefresh}>
              {refreshing ? <IconLoader size={12} /> : <IconRefresh size={12} />}Cập nhật ngay
            </button>
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 6 }}>{error}</div>}

      {editing ? (
        <>
          <textarea style={textareaStyle} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Mô tả cách hành văn của bạn: từ ngữ quen dùng, độ dài câu, giọng điệu..." />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" style={btnStyle} disabled={saving} onClick={handleSave}>
              {saving ? <IconLoader size={12} /> : <IconCheck size={12} />}Lưu
            </button>
            <button type="button" style={btnStyle} disabled={saving} onClick={() => setEditing(false)}>
              <IconX size={12} />Hủy
            </button>
          </div>
        </>
      ) : profile?.profileText ? (
        <>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--text)', margin: 0 }}>{profile.profileText}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
            {profile.locked
              ? 'Bạn đã tự sửa hồ sơ này — AI biên tập/trợ lý sẽ dùng đúng bản này, tự động cập nhật định kỳ sẽ không ghi đè.'
              : `Dựa trên ${profile.sourcePostCount} bài đã duyệt gần nhất — AI biên tập/trợ lý sẽ tham khảo hồ sơ này khi hỗ trợ bạn.`}
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Chưa đủ dữ liệu (cần ít nhất {profile?.minSourcePosts || 3} bài đã duyệt). Hồ sơ sẽ tự xuất hiện khi đủ bài, bấm "Cập nhật ngay" để thử luôn, hoặc tự viết tay.
          </p>
          <button type="button" style={{ ...btnStyle, marginTop: 8 }} onClick={startEdit}>
            <IconEdit size={12} />Tự viết hồ sơ
          </button>
        </>
      )}
    </div>
  );
};

export default StyleProfilePanel;
