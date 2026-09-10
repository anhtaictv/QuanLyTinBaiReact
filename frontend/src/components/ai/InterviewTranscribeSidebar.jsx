import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconMic, IconX, IconAlertCircle, IconCheck, IconCloudUpload } from '../icons';
import { SEGMENT_SECONDS, formatDuration, needsSplitting, prepareSegments, probeDuration } from '../../utils/audioChunk';
import { transcribeAudio } from '../../services/aiService';

const SpeechRecognitionCtor = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600
};

// Hai đường vào cùng một ô chữ:
// 1. Đọc-vào-chữ trực tiếp bằng Web Speech API của trình duyệt — không cần hạ tầng mới,
//    chỉ chạy trên Chrome/Edge (Firefox chưa hỗ trợ).
// 2. Rã băng file ghi âm có sẵn qua PhoWhisper trên máy A (/api/ai/transcribe). Upstream chỉ
//    nhận tối đa 30 giây mỗi lượt, nên file dài được cắt thành từng đoạn 25s ở client rồi
//    rã tuần tự và nối chữ lại — xem utils/audioChunk.js để biết vì sao có trần đó.
const InterviewTranscribeSidebar = ({ onClose, onInsertSapo, onInsertNoiDung }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');            // lỗi của phần đọc trực tiếp
  const [uploadError, setUploadError] = useState(''); // lỗi của phần rã băng file
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total } khi đang rã băng nhiều đoạn
  const recognitionRef = useRef(null);
  const wantListeningRef = useRef(false); // để onend biết có nên tự khởi động lại không
  const fileInputRef = useRef(null);
  const abortRef = useRef(null); // AbortController của lượt rã băng đang chạy

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

  // Hủy hẳn vòng rã băng khi bảng bị đóng/tháo. Để nó chạy tiếp thì một băng 20 phút bị đóng
  // ở đoạn 5 vẫn nã tiếp ~43 request, chiếm 1 trong 4 slot upload của gateway suốt mấy phút
  // và làm chậm mọi người khác đang dùng AI — mà chẳng ai còn nhìn kết quả nữa.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  const appendTranscript = useCallback((text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    setTranscript(prev => (prev ? prev + '\n\n' : '') + clean);
  }, []);

  // Lấy đúng câu lỗi tiếng Việt mà backend/gateway trả về thay vì đè bằng "Transcribe
  // failed" — người dùng cần biết là máy A tắt hay là file quá dài.
  const transcribeOne = useCallback(async (payload, signal) => {
    try {
      const { data } = await transcribeAudio(payload, { signal });
      return data?.text || '';
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message || 'không gọi được backend');
    }
  }, []);

  const handleTranscribeFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setUploading(true);
    setUploadError('');
    setProgress(null);

    try {
      const duration = await probeDuration(file);

      if (!needsSplitting(duration)) {
        // Đủ ngắn: gửi nguyên bản, khỏi decode rồi nén lại WAV cho tốn công.
        appendTranscript(await transcribeOne(file, controller.signal));
        return;
      }

      const { segments, encodeSegment } = await prepareSegments(file);
      if (segments.length === 0) throw new Error('File không có dữ liệu audio đọc được.');

      const parts = [];
      let failure = null;

      for (const segment of segments) {
        if (controller.signal.aborted) break;
        setProgress({ current: segment.index + 1, total: segments.length });
        try {
          // Tuần tự, KHÔNG Promise.all: gateway chặn ở MAX_AUDIO_UPLOADS_IN_FLIGHT=4 và
          // PhoWhisper máy A chỉ có một GPU — bơm song song chỉ đổi 429 lấy nhau.
          // Nén WAV ngay tại đây rồi thả, không giữ cả ~62 blob trong RAM.
          parts.push(await transcribeOne(encodeSegment(segment), controller.signal));
        } catch (err) {
          if (controller.signal.aborted) break;
          failure = { at: segment.index + 1, message: err.message, end: segment.start };
          break;
        }
      }

      // Người dùng chủ động hủy thì im lặng, không báo lỗi — nhưng phần đã rã vẫn giữ.
      // Giữ phần đã rã xong trước khi báo lỗi: băng 20 phút chết ở đoạn 40/48 mà mất trắng
      // thì người dùng phải làm lại từ đầu, vô lý.
      // Lọc đoạn rỗng (khoảng lặng, đoạn dư cuối băng) trước khi nối, không thì transcript
      // dính một chuỗi khoảng trắng đôi ở đúng chỗ có đoạn im lặng.
      appendTranscript(parts.map(part => part.trim()).filter(Boolean).join(' '));
      if (failure) {
        // Mốc thật của đoạn hỏng, không phải parts.length * SEGMENT_SECONDS — đoạn cuối băng
        // ngắn hơn trần nên phép nhân đó nói quá thời lượng đã giữ được.
        setUploadError(`Lỗi ở đoạn ${failure.at}/${segments.length} (phút ${formatDuration(failure.end)}): ${failure.message} — phần trước đó đã giữ ở ô trên.`);
      }
    } catch (err) {
      if (!controller.signal.aborted) setUploadError(err.message || 'Không thể kết nối backend.');
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [appendTranscript, transcribeOne]);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100vw', zIndex: 600,
      display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-md)', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <strong style={{ fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 7 }}><IconMic size={16} />Rã băng phỏng vấn</strong>
        <button
          onClick={handleClose}
          aria-label={uploading ? 'Đóng và hủy rã băng' : 'Đóng'}
          title={uploading ? 'Đóng và hủy rã băng' : 'Đóng'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
        ><IconX size={17} /></button>
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
          <div>
            {!uploading
              ? 'Chọn file audio để rã băng (MP3, WAV, WebM...)'
              : progress
                ? `Đang rã băng đoạn ${progress.current}/${progress.total}...`
                : 'Đang đọc file...'}
          </div>
        </label>

        {/* Băng dài được cắt tự động nên người dùng không cần tự cắt, nhưng vẫn phải nói ra:
            file 20 phút là 48 lượt gọi máy A, ai không biết sẽ tưởng treo rồi đóng giữa chừng. */}
        {uploading && progress && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(progress.current / progress.total) * 100}%`,
                background: 'var(--accent)', transition: 'width var(--duration-normal, 300ms) ease-out'
              }} />
            </div>
          </div>
        )}

        {uploadError && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)', display: 'flex', gap: 6 }}>
            <IconAlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{uploadError}
          </div>
        )}

        {!uploading && !uploadError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Băng dài hơn {SEGMENT_SECONDS} giây sẽ tự được cắt thành từng đoạn {SEGMENT_SECONDS} giây và rã lần lượt — không cần tự cắt file. Băng càng dài càng lâu.
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewTranscribeSidebar;
