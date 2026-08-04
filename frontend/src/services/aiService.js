import api from './api';

// Trợ lý AI có thể chưa bật (gateway chưa chạy) — mọi hàm ở đây để lỗi ném ra nguyên
// vẹn cho view tự quyết cách hiển thị, không nuốt lỗi âm thầm.

export const getAiHealth = async () => {
  const { data } = await api.get('/ai/health');
  return data;
};

// messages: [{ role: 'user' | 'assistant', content: string }]
// Gửi lại toàn bộ hội thoại mỗi lượt vì backend không lưu trạng thái phiên chat.
export const askAssistant = async (messages) => {
  const { data } = await api.post('/ai/chat', { messages });
  return data.reply;
};
