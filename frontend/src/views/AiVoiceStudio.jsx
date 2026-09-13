import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconMic, IconAlertCircle, IconCloudUpload, IconDownload, IconUser } from '../components/icons';
import { listVoices, createVoice, synthesizeSpeech } from '../services/aiService';
import { showToastSuccess, showToastError } from '../utils/Toast';

const MAX_TTS_CHARS = 4000; // khớp trần backend/gateway, xem aiController.js:synthesizeSpeech

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', padding: 24,
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
};

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600
};

const sectionLabel = {
  fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)',
  marginBottom: 8, textTransform: 'uppercase'
};

const inputStyle = {
  width: '100%', padding: '9px 12px', fontSize: 13.5, boxSizing: 'border-box',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-2)', color: 'var(--text)'
};

// Module riêng, không gắn với bài viết cụ thể — dán/nhập text bất kỳ, chọn giọng (có sẵn
// hoặc tự nhân bản từ 1 file audio mẫu), sinh và tải/nghe thử ngay. Không lưu lại audio đã
// sinh (stateless như /transcribe) — mỗi lượt là một lần gọi VoiceStudio trên máy A.
const AiVoiceStudio = () => {
  const [voices, setVoices] = useState([]);
  const [voicesError, setVoicesError] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('default');

  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceFile, setNewVoiceFile] = useState(null);
  const [creatingVoice, setCreatingVoice] = useState(false);
  const fileInputRef = useRef(null);

  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const audioUrlRef = useRef(null);

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    setVoicesError('');
    try {
      const { data } = await listVoices();
      const list = data?.voices || [];
      setVoices(list);
      // Giữ lựa chọn hiện tại nếu vẫn còn trong danh sách mới, không thì rơi về "default".
      setSelectedVoice(prev => (list.some(v => v.voice_id === prev) ? prev : 'default'));
    } catch (err) {
      // Gateway/máy A tắt là trạng thái bình thường (giống transcribe) — nói rõ nguyên
      // nhân thay vì "Network Error" chung chung.
      setVoicesError(err.response?.data?.error || 'Không lấy được danh sách giọng đọc — máy chạy VoiceStudio có thể đang tắt.');
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => { loadVoices(); }, [loadVoices]);

  // Thu hồi Object URL cũ khi tạo url mới hoặc rời trang — không thì mỗi lượt sinh giọng
  // rò rỉ 1 blob trong bộ nhớ trình duyệt cho tới khi tải lại trang.
  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  const handleCreateVoice = useCallback(async (e) => {
    e.preventDefault();
    const name = newVoiceName.trim();
    if (!name) return showToastError('Đặt tên cho giọng trước đã.');
    if (!newVoiceFile) return showToastError('Chọn 1 file audio mẫu (giọng đọc rõ, ít tạp âm, 10-30 giây là đủ).');

    setCreatingVoice(true);
    try {
      const { data } = await createVoice(name, newVoiceFile);
      showToastSuccess(`Đã tạo giọng "${name}".`);
      setNewVoiceName('');
      setNewVoiceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadVoices();
      if (data?.id) setSelectedVoice(data.id);
    } catch (err) {
      showToastError(err.response?.data?.error || 'Không tạo được giọng — thử lại sau.');
    } finally {
      setCreatingVoice(false);
    }
  }, [newVoiceName, newVoiceFile, loadVoices]);

  const handleGenerate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data } = await synthesizeSpeech(trimmed, selectedVoice);
      const url = URL.createObjectURL(data);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (err) {
      // Lỗi trả về là blob (responseType: 'blob'), phải đọc lại thành text mới lấy được
      // câu tiếng Việt của backend — mặc định err.response.data ở đây là 1 Blob, không
      // phải object JSON như mọi lỗi khác trong app.
      let message = 'Không tạo được giọng đọc — thử lại sau.';
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try { message = JSON.parse(await blob.text())?.error || message; } catch { /* giữ message mặc định */ }
      }
      setGenError(message);
    } finally {
      setGenerating(false);
    }
  }, [text, selectedVoice]);

  const overLimit = text.length > MAX_TTS_CHARS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860, margin: '0 auto' }}>
      <div style={card}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <IconMic size={18} style={{ color: 'var(--accent)' }} />
            Giọng đọc AI
          </h3>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: 13 }}>
            Nhân bản giọng nói từ 1 file audio mẫu, rồi dùng giọng đó để đọc bất kỳ đoạn văn bản nào.
          </p>
        </div>

        <div style={sectionLabel}>Tạo giọng mới từ file mẫu</div>
        <form onSubmit={handleCreateVoice} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            value={newVoiceName}
            onChange={(e) => setNewVoiceName(e.target.value)}
            placeholder="Tên giọng, vd: Giọng MC A"
            style={inputStyle}
            disabled={creatingVoice}
          />
          <label style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, cursor: creatingVoice ? 'not-allowed' : 'pointer', opacity: creatingVoice ? 0.6 : 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setNewVoiceFile(e.target.files?.[0] || null)}
              disabled={creatingVoice}
              style={{ display: 'none' }}
            />
            <IconCloudUpload size={20} style={{ marginBottom: 4, opacity: 0.6 }} />
            <div>{newVoiceFile ? newVoiceFile.name : 'Chọn file audio mẫu (10-30 giây, giọng rõ, ít tạp âm)'}</div>
          </label>
          <button type="submit" disabled={creatingVoice} style={{
            ...btnStyle, justifyContent: 'center', background: 'var(--accent)', color: '#fff', border: 'none',
            opacity: creatingVoice ? 0.6 : 1, cursor: creatingVoice ? 'not-allowed' : 'pointer'
          }}>
            <IconUser size={14} />{creatingVoice ? 'Đang tạo giọng...' : 'Tạo giọng'}
          </button>
        </form>
      </div>

      <div style={card}>
        <div style={sectionLabel}>Chọn giọng đọc</div>
        {loadingVoices ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đang tải danh sách giọng...</div>
        ) : voicesError ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--warning)', background: 'var(--warning-soft)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
            <IconAlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            {voicesError}
          </div>
        ) : (
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} style={inputStyle}>
            {voices.map(v => (
              <option key={v.voice_id} value={v.voice_id}>{v.name || v.voice_id}</option>
            ))}
          </select>
        )}

        <div style={{ ...sectionLabel, margin: '24px 0 8px' }}>Nội dung cần đọc</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dán hoặc gõ nội dung cần chuyển thành giọng đọc..."
          rows={10}
          style={{
            width: '100%', padding: 12, fontSize: 13.5, lineHeight: 1.7, boxSizing: 'border-box',
            border: `1px solid ${overLimit ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical'
          }}
        />
        <div style={{ fontSize: 12, color: overLimit ? 'var(--danger)' : 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
          {text.length}/{MAX_TTS_CHARS}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !text.trim() || overLimit || loadingVoices}
          style={{
            ...btnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px', marginTop: 12,
            background: 'var(--accent)', color: '#fff', border: 'none',
            opacity: (generating || !text.trim() || overLimit || loadingVoices) ? 0.6 : 1
          }}
        >
          <IconMic size={15} />
          {generating ? 'Đang tạo giọng đọc...' : 'Tạo giọng đọc'}
        </button>

        {genError && (
          <div role="alert" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)', display: 'flex', gap: 6 }}>
            <IconAlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{genError}
          </div>
        )}

        {audioUrl && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
            <a href={audioUrl} download="giong-doc-ai.mp3" style={{ ...btnStyle, textDecoration: 'none', alignSelf: 'flex-start' }}>
              <IconDownload size={14} />Tải file audio
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiVoiceStudio;
