// Cắt file audio dài thành từng đoạn ngắn để rã băng được trọn băng phỏng vấn.
//
// Lý do tồn tại: service PhoWhisper trên máy A gọi pipeline Whisper mà KHÔNG truyền
// return_timestamps=True, nên transformers từ chối mọi audio dài quá 30 giây bằng HTTP 500
// (xem AudioTooLongError trong C:\ai-gateway\server.js — đo thật 08/09/2026: file 60s trả
// 500 kể cả khi gateway gửi kèm return_timestamps, upstream bỏ qua tham số thừa). Gateway
// KHÔNG sửa được chuyện này, nên chỗ duy nhất xử lý được mà không phải đụng vào máy A là
// client: tự cắt băng thành các đoạn dưới trần rồi rã từng đoạn, sau đó nối chữ theo thứ tự.

// 25s chứ không phải đúng 30s: chừa biên an toàn cho sai số làm tròn khi decode/resample.
// Một đoạn nhích lên 30.01s là đủ ăn HTTP 500, và lỗi đó không retry được.
export const SEGMENT_SECONDS = 25;

// PhoWhisper (Whisper) làm việc ở 16kHz mono. Decode thẳng về đúng tần số này vừa cắt
// ~5.5 lần RAM so với 44.1kHz stereo (băng 25 phút: ~190MB xuống ~48MB), vừa khỏi để
// upstream phải resample lại một lần nữa.
const TARGET_SAMPLE_RATE = 16000;

// Đoạn ngắn hơn mức này chỉ là phần dư do làm tròn — gửi lên chỉ tốn một vòng gọi mạng
// để nhận lại chuỗi rỗng.
const MIN_SEGMENT_SECONDS = 0.25;

const BYTES_PER_SAMPLE = 2; // PCM 16-bit
const BITS_PER_BYTE = 8;
const PCM_FORMAT_TAG = 1; // 1 = PCM không nén
const MONO_CHANNELS = 1;
const INT16_MAX = 32767;
const WAV_HEADER_BYTES = 44;
const FMT_CHUNK_BYTES = 16;
const RIFF_PREFIX_BYTES = 36; // kích thước khối RIFF không tính 8 byte "RIFF" + độ dài
const SECONDS_PER_MINUTE = 60;

export const stripExtension = (filename) =>
  String(filename || '').replace(/\.[^./\\]+$/, '');

// "3:05" — dùng trong thông báo tiến độ cho người dùng biết đang rã tới đâu.
export const formatDuration = (seconds) => {
  const total = Math.max(Math.round(Number(seconds) || 0), 0);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  return `${minutes}:${String(total % SECONDS_PER_MINUTE).padStart(2, '0')}`;
};

// Chia mốc thời gian trước, tách khỏi Web Audio API để test được bằng jsdom.
// Trả về [{ index, start, end }] theo thứ tự thời gian.
export const planSegments = (durationSeconds, segmentSeconds = SEGMENT_SECONDS) => {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const requested = Number(segmentSeconds);
  const step = Number.isFinite(requested) && requested > 0 ? requested : SEGMENT_SECONDS;

  const bounds = [];
  for (let start = 0; start < duration; start += step) {
    bounds.push({ start, end: Math.min(start + step, duration) });
  }

  // Bỏ phần dư quá ngắn, nhưng luôn giữ lại ít nhất một đoạn: file 0.1s vẫn phải rã được
  // chứ không được biến thành "không có đoạn nào" rồi báo lỗi vô cớ.
  const kept = bounds.filter(({ start, end }) => end - start >= MIN_SEGMENT_SECONDS);
  const usable = kept.length > 0 ? kept : bounds.slice(0, 1);

  return usable.map((bound, index) => ({ index, ...bound }));
};

export const needsSplitting = (durationSeconds, segmentSeconds = SEGMENT_SECONDS) => {
  const duration = Number(durationSeconds);
  // Không đọc được thời lượng (WebM từ MediaRecorder hay trả Infinity) thì cứ cắt cho chắc:
  // cắt file ngắn vẫn ra kết quả đúng, còn gửi thẳng file dài thì chết ở upstream.
  if (!Number.isFinite(duration) || duration <= 0) return true;
  return duration > segmentSeconds;
};

// Đọc thời lượng bằng thẻ <audio> thay vì decode cả file: file ngắn nhờ đó được gửi
// nguyên bản, không phải chịu một vòng decode + nén lại WAV vô ích.
// Trả null khi không đọc được, để bên gọi tự quyết (needsSplitting coi null là "phải cắt").
export const probeDuration = (file) => new Promise((resolve) => {
  if (typeof Audio !== 'function' || typeof URL?.createObjectURL !== 'function') {
    resolve(null);
    return;
  }

  const url = URL.createObjectURL(file);
  const audio = new Audio();

  const finish = (value) => {
    URL.revokeObjectURL(url);
    resolve(value);
  };

  audio.addEventListener('loadedmetadata', () => {
    finish(Number.isFinite(audio.duration) ? audio.duration : null);
  });
  audio.addEventListener('error', () => finish(null));

  audio.preload = 'metadata';
  audio.src = url;
});

const createDecodeContext = () => {
  const AudioContextCtor = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext)
    : null;
  if (!AudioContextCtor) {
    throw new Error('Trình duyệt này không hỗ trợ Web Audio API nên không cắt được băng dài — dùng Chrome hoặc Edge.');
  }
  try {
    return new AudioContextCtor({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    // Trình duyệt cũ không nhận option sampleRate: chấp nhận tần số mặc định của thiết bị.
    // Chỉ tốn RAM hơn, còn mốc cắt vẫn tính theo giây nên kết quả không đổi.
    return new AudioContextCtor();
  }
};

export const decodeAudioFile = async (file) => {
  const context = createDecodeContext();
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } catch (err) {
    throw new Error(`Không đọc được nội dung audio của "${file.name}" — file có thể hỏng hoặc dùng codec trình duyệt không giải mã được.`, { cause: err });
  } finally {
    // AudioBuffer đã decode xong sống độc lập với context, đóng ngay để trả thiết bị audio.
    if (typeof context.close === 'function') context.close();
  }
};

// Trộn mọi kênh về mono trong đúng khoảng [startSecond, endSecond).
//
// Math.round cho CẢ hai đầu, không phải floor cho start và ceil cho end: hai đoạn liền nhau
// dùng chung một mốc giây, mà làm tròn hai kiểu khác nhau thì cùng một mốc ra hai frame khác
// nhau — một mẫu PCM bị lặp sang đoạn sau hoặc rơi mất giữa hai đoạn. Round thì mốc chung
// luôn cho ra cùng một frame, giữ đúng bất biến "không chồng lấn, không hở" mà planSegments đặt ra.
const extractMonoSlice = (audioBuffer, startSecond, endSecond) => {
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const startFrame = Math.min(Math.round(startSecond * sampleRate), length);
  const endFrame = Math.min(Math.round(endSecond * sampleRate), length);
  const frameCount = Math.max(endFrame - startFrame, 0);

  const mono = new Float32Array(frameCount);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const samples = audioBuffer.getChannelData(channel);
    for (let frame = 0; frame < frameCount; frame++) {
      mono[frame] += samples[startFrame + frame] / numberOfChannels;
    }
  }
  return mono;
};

// PCM 16-bit mono. Phải là WAV chứ không phải MP3: trình duyệt chỉ có bộ giải mã, không có
// bộ nén — muốn xuất MP3 thì phải kéo thêm encoder vào bundle, mà WAV thì PhoWhisper nhận sẵn.
export const encodeWavMono = (samples, sampleRate) => {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, RIFF_PREFIX_BYTES + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, FMT_CHUNK_BYTES, true);
  view.setUint16(20, PCM_FORMAT_TAG, true);
  view.setUint16(22, MONO_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * MONO_CHANNELS * BYTES_PER_SAMPLE, true); // byte mỗi giây
  view.setUint16(32, MONO_CHANNELS * BYTES_PER_SAMPLE, true);              // byte mỗi frame
  view.setUint16(34, BYTES_PER_SAMPLE * BITS_PER_BYTE, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    // Kẹp TRƯỚC khi nhân: mẫu float của Web Audio có thể vượt ±1 sau khi trộn kênh, để tràn
    // thì setInt16 quấn vòng, biến đỉnh sóng thành tiếng nổ lách tách.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, Math.round(clamped * INT16_MAX), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

// Decode file rồi trả về kế hoạch cắt kèm hàm nén từng đoạn theo yêu cầu.
//
// CỐ Ý không nén sẵn hết thành mảng File: băng 26 phút ra ~62 đoạn, mỗi WAV ~800KB, giữ hết
// cùng lúc là ~50MB blob nằm cạnh AudioBuffer đã ~190MB — trong khi bên gọi rã tuần tự,
// mỗi lúc chỉ cần đúng một đoạn. Nén ngay trước khi gửi rồi thả ra thì đỉnh RAM thấp hơn hẳn.
// Trả { duration, segments: [{ index, start, end }], encodeSegment }.
export const prepareSegments = async (file, segmentSeconds = SEGMENT_SECONDS) => {
  const audioBuffer = await decodeAudioFile(file);
  const segments = planSegments(audioBuffer.duration, segmentSeconds);
  const baseName = stripExtension(file.name) || 'audio';
  const padWidth = String(segments.length).length;

  const encodeSegment = ({ index, start, end }) => {
    const blob = encodeWavMono(extractMonoSlice(audioBuffer, start, end), audioBuffer.sampleRate);
    const name = `${baseName}-doan-${String(index + 1).padStart(padWidth, '0')}.wav`;
    return new File([blob], name, { type: 'audio/wav' });
  };

  return { duration: audioBuffer.duration, segments, encodeSegment };
};
