import api from './api';

export const getAiHealth = () => api.get('/ai/health');

// Module 1: Trợ lý biên tập
export const proofreadText = (text) => api.post('/ai/editorial/proofread', { text });
export const suggestHeadlines = (content) => api.post('/ai/editorial/headlines', { content });
export const summarizeContent = (content) => api.post('/ai/editorial/summarize', { content });

// Module 2: Phân loại & gắn tag tự động
export const categorizeContent = (content) => api.post('/ai/categorize', { content });

// Module 3: Kiểm duyệt & bảo mật thông tin
export const scanSensitive = (text) => api.post('/ai/scan-sensitive', { text });

// Module 4: RAG tra cứu văn bản quy định
export const listRagDocuments = () => api.get('/ai/rag/documents');
export const ingestRagDocument = (title, content) => api.post('/ai/rag/documents', { title, content });
export const deleteRagDocument = (sourceId) => api.delete(`/ai/rag/documents/${sourceId}`);
export const askRag = (question) => api.post('/ai/rag/ask', { question });

// AI giám sát chất lượng: đối chiếu bài viết với corpus bài đã duyệt (fact-check) hoặc
// cẩm nang tòa soạn (consistency) — cả 2 dùng chung kho tri thức RAG ở trên.
export const factCheckContent = (content) => api.post('/ai/rag/factcheck', { content });
export const checkConsistency = (content) => api.post('/ai/rag/consistency', { content });

// Rã băng file ghi âm (PhoWhisper trên máy A).
//
// Phải đi qua `api` chứ không phải fetch trực tiếp: interceptor của api.js mới là chỗ gắn
// Authorization, mà /api/ai/* đều nằm sau verifyToken — gọi fetch tay là ăn 401 ngay.
// Content-Type để undefined cho trình duyệt tự điền kèm boundary của multipart; giữ
// 'application/json' mặc định của instance thì backend không parse ra file.
// signal: để bên gọi hủy được khi người dùng đóng bảng giữa lúc đang rã băng dài.
export const transcribeAudio = (file, { signal } = {}) => {
  const formData = new FormData();
  formData.append('file', file, file.name);
  return api.post('/ai/transcribe', formData, { signal, headers: { 'Content-Type': undefined } });
};

// Module 5: Trợ lý hỏi tự do (hội thoại nhiều lượt)
// messages: [{ role: 'user' | 'assistant', content: string }] — gửi lại toàn bộ hội thoại
// mỗi lượt vì backend không lưu trạng thái phiên chat.
export const askAssistant = (messages) => api.post('/ai/chat', { messages });

// Module 6: Hồ sơ văn phong cá nhân — AI tự tóm tắt cách hành văn từ bài đã duyệt của
// chính người dùng, dùng làm ngữ cảnh thêm cho proofread/headlines/sapo/chat ở trên.
export const getMyStyleProfile = () => api.get('/ai/style-profile');
export const refreshMyStyleProfile = () => api.post('/ai/style-profile/refresh');
export const updateMyStyleProfile = (profileText) => api.put('/ai/style-profile', { profileText });

// Module 7: Giọng đọc AI (TTS + voice clone qua VoiceStudio trên máy A).
export const listVoices = () => api.get('/ai/voices');

// Tạo voice clone từ 1 file audio mẫu — cùng lý do Content-Type: undefined như
// transcribeAudio (multipart cần trình duyệt tự điền boundary).
export const createVoice = (name, file) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file, file.name);
  return api.post('/ai/voices', formData, { headers: { 'Content-Type': undefined } });
};

// responseType: 'blob' để nhận về audio nhị phân thay vì cố parse JSON — xem
// PostDetail.jsx:handleDownloadFile để biết cách dựng lại thành link tải/phát.
export const synthesizeSpeech = (text, voice) =>
  api.post('/ai/speech', { text, voice }, { responseType: 'blob' });

// Máy A chỉ có MỘT GPU worker cho giọng đọc: ai bấm đọc trong lúc nó đang đọc bài khác sẽ
// ăn 503 "máy đọc đang bận" ngay tức khắc. Đó là trạng thái BÌNH THƯỜNG của 3 app dùng
// chung một máy, không phải hỏng hóc — bắt người dùng tự bấm lại giữa bài đang đọc dở là
// hỏng cả lượt đọc, nên tự chờ rồi thử lại đúng đoạn đó.
export const SPEECH_RETRY_ATTEMPTS = 3;
const SPEECH_RETRY_FALLBACK_MS = 20000;
const SPEECH_RETRY_MAX_WAIT_MS = 90000;

// Gateway gửi kèm Retry-After (giây) lấy từ chính câu trả lời của máy A ("safe to retry in
// about 107s") — chờ đúng khoảng đó thay vì đoán mò.
const retryAfterMs = (err) => {
  const seconds = Number(err?.response?.headers?.['retry-after']);
  if (!Number.isFinite(seconds) || seconds <= 0) return SPEECH_RETRY_FALLBACK_MS;
  return Math.min(seconds * 1000, SPEECH_RETRY_MAX_WAIT_MS);
};

// 503 = máy bận/hạ tầng, thử lại có ích. 4xx (nội dung sai) và 504 (đoạn này quá dài) thì
// thử lại bao nhiêu lần cũng vậy, trả lỗi ngay cho người dùng biết đường sửa.
const isBusyError = (err) => err?.response?.status === 503;

const defaultWait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const synthesizeSpeechChunk = async (text, voice, { attempts = SPEECH_RETRY_ATTEMPTS, wait = defaultWait } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await synthesizeSpeech(text, voice);
    } catch (err) {
      lastError = err;
      if (!isBusyError(err) || attempt === attempts) throw err;
      await wait(retryAfterMs(err));
    }
  }
  throw lastError;
};
