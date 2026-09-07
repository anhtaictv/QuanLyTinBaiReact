import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconMic, IconX, IconAlertCircle, IconCheck, IconCloudUpload } from '../icons';

const SpeechRecognitionCtor = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600
};

// Giai đoạn 1 (đang làm): đọc-vào-chữ trực tiếp bằng Web Speech API của trình duyệt —
// không cần backend/hạ tầng mới, chỉ chạy trên Chrome/Edge (Firefox chưa hỗ trợ).
// Giai đoạn 2 (chưa làm): rã băng file ghi âm phỏng vấn có sẵn — cần thêm model
// Speech-to-Text (vd Whisper) vào AI Gateway trước, aiGatewayClient.js hiện chỉ xử lý
// text. Để khung UI ở trạng thái "chưa khả dụng" thay vì giả vờ chạy được.
const InterviewTranscribeSidebar = ({ onClose, onInsertSapo, onInsertNoiDung }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef(null);
  const wantListeningRef = useRef(false); // để onend biết có nên tự khởi động lại không
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk) setTranscript(prev => (prev ? prev + ' ' : '') + finalChunk.trim());
      setInterim(interimChunk);
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Trình duyệt bị chặn quyền dùng micro — cho phép quyền rồi thử lại.',
        'no-speech': 'Không nghe thấy giọng nói, thử nói to hơn hoặc kiểm tra micro.',
        'audio-capture': 'Không tìm thấy micro trên thiết bị này.',
        'network': 'Mất kết nối mạng khi nhận diện giọng nói.',
      };
      setError(messages[event.error] || `Lỗi nhận diện giọng nói: ${event.error}`);
    };

    // Chrome tự dừng recognition sau vài giây im lặng dù continuous=true — tự khởi động
    // lại nếu người dùng chưa chủ động bấm dừng, để việc đọc liên tục không bị ngắt quãng.
    recognition.onend = () => {
      if (wantListeningRef.current) {
        try { recognition.start(); } catch { /* đã start rồi, bỏ qua */ }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      wantListeningRef.current = false;
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      wantListeningRef.current = false;
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError('');
      setInterim('');
      wantListeningRef.current = true;
      recognitionRef.current.start();
      setListening(true);
    }
  }, [listening]);

  const handleTranscribeFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Transcribe failed');
      const data = await response.json();
      setTranscript(prev => (prev ? prev + '\n\n' : '') + (data.text || ''));
    } catch (err) {
      setError('Lỗi rã băng: ' + (err.message || 'Không thể kết nối backend'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100vw', zIndex: 600,
      display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-md)', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <strong style={{ fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 7 }}><IconMic size={16} />Rã băng phỏng vấn</strong>
        <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><IconX size={17} /></button>
      </div>

      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
          Đọc trực tiếp vào chữ
        </div>

        {!SpeechRecognitionCtor ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--warning)', background: 'var(--warning-soft)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
            <IconAlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            Trình duyệt này chưa hỗ trợ nhận diện giọng nói — dùng Chrome hoặc Edge.
          </div>
        ) : (
          <>
            <button onClick={toggleListening} style={{
              ...btnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px',
              background: listening ? 'var(--danger)' : 'var(--accent)', color: '#fff', border: 'none'
            }}>
              <IconMic size={15} />{listening ? 'Đang nghe — bấm để dừng' : 'Bấm để bắt đầu đọc'}
            </button>

            {error && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)', display: 'flex', gap: 6 }}>
                <IconAlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{error}
              </div>
            )}

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Nội dung đọc được sẽ hiện ở đây — có thể sửa tay trước khi chèn vào bài."
              rows={10}
              style={{
                width: '100%', marginTop: 12, padding: 10, fontSize: 13.5, lineHeight: 1.6,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
            {/* Xem trước phần đang nói, CHƯA chốt — tách riêng khỏi ô có thể sửa ở trên để
                sửa tay giữa lúc đang nghe không bị lặp lại khi đoạn này chốt thành final. */}
            {interim && (
              <div style={{ marginTop: 6, fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {interim}…
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => { onInsertSapo(transcript.trim()); setTranscript(''); }}
                disabled={!transcript.trim()}
                style={{ ...btnStyle, opacity: transcript.trim() ? 1 : 0.5, cursor: transcript.trim() ? 'pointer' : 'not-allowed' }}
              >
                <IconCheck size={13} />Chèn vào Sapo
              </button>
              <button
                onClick={() => { onInsertNoiDung(transcript.trim()); setTranscript(''); }}
                disabled={!transcript.trim()}
                style={{ ...btnStyle, opacity: transcript.trim() ? 1 : 0.5, cursor: transcript.trim() ? 'pointer' : 'not-allowed' }}
              >
                <IconCheck size={13} />Chèn vào Nội dung tóm tắt
              </button>
            </div>
          </>
        )}

        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', margin: '24px 0 8px', textTransform: 'uppercase' }}>
          Rã băng file ghi âm
        </div>
        <label style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, cursor: uploading ? 'not-allowed' : 'pointer', display: 'block', opacity: uploading ? 0.6 : 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleTranscribeFile}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <IconCloudUpload size={20} style={{ marginBottom: 6, opacity: 0.6 }} />
          <div>{uploading ? 'Đang xử lý...' : 'Chọn file audio để rã băng (MP3, WAV, WebM...)'}</div>
        </label>
      </div>
    </div>
  );
};

export default InterviewTranscribeSidebar;
