import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/aiService', () => ({
  transcribeAudio: vi.fn(() => Promise.resolve({ data: { text: '' } }))
}));

// SpeechRecognitionCtor và isSecureContext được đọc MỘT LẦN lúc module nạp, nên phải dựng
// window trước rồi mới import động — import tĩnh ở đầu file sẽ chốt giá trị cũ.
const loadPage = async ({ secure = true, ctor = undefined } = {}) => {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  if (ctor) window.webkitSpeechRecognition = ctor;
  else delete window.webkitSpeechRecognition;
  vi.resetModules();
  return (await import('./InterviewTranscribe')).default;
};

// Mô phỏng đúng trình tự Chrome phát ra khi start() hỏng: onerror rồi onend.
//
// failTimes CÓ CHỦ ĐÍCH mặc định là 1: nếu để fake lỗi mãi mãi thì vòng
// start -> onerror -> onend -> start chạy hết bằng microtask, không nhả event loop lần nào
// và giết luôn worker của vitest (đã dính thật). Lỗi đúng một lần là đủ phân biệt
// "dừng hẳn" với "khởi động lại", mà vẫn kết thúc được.
const makeFakeRecognition = (errorCode, { failTimes = 1 } = {}) => {
  const starts = vi.fn();
  let failures = 0;
  class FakeRecognition {
    start() {
      starts();
      if (!errorCode || failures >= failTimes) return;
      failures++;
      Promise.resolve().then(() => {
        this.onerror?.({ error: errorCode });
        this.onend?.();
      });
    }
    stop() { this.onend?.(); }
  }
  return { FakeRecognition, starts };
};

describe('Nút đọc trực tiếp', () => {
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => { delete window.webkitSpeechRecognition; });

  // Bug thật: onend tự gọi start() lại mà onerror không hạ wantListeningRef, nên một lỗi cố
  // định (mic bị từ chối) đẻ ra vòng start -> onerror -> onend -> start... vô tận. Người dùng
  // thấy nút kẹt ở "Đang nghe" và không ra chữ nào — đúng triệu chứng "bấm mà không chạy".
  test('mic bị từ chối thì dừng hẳn, KHÔNG tự khởi động lại vô tận', async () => {
    // Arrange
    const { FakeRecognition, starts } = makeFakeRecognition('not-allowed');
    const Page = await loadPage({ ctor: FakeRecognition });
    render(<Page />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Bấm để bắt đầu đọc/ }));

    // Assert
    await waitFor(() => expect(screen.getByText(/chặn quyền dùng micro/)).toBeInTheDocument());
    await new Promise(r => setTimeout(r, 50)); // để vòng lặp (nếu còn) kịp quay thêm
    expect(starts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Bấm để bắt đầu đọc/ })).toBeInTheDocument();
  });

  // Ngược lại: im lặng vài giây là chuyện thường, Chrome tự ngắt và ta PHẢI nối lại,
  // không thì đọc một lúc là tự chết giữa chừng.
  test('im lặng (no-speech) thì vẫn tự nối lại để đọc liên tục', async () => {
    // Arrange
    const { FakeRecognition, starts } = makeFakeRecognition('no-speech');
    const Page = await loadPage({ ctor: FakeRecognition });
    render(<Page />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Bấm để bắt đầu đọc/ }));

    // Assert
    await waitFor(() => expect(starts.mock.calls.length).toBeGreaterThan(1));
  });

  test('trang mở bằng http thì nói thẳng là bị chặn, không đổ lỗi cho trình duyệt', async () => {
    // Arrange — webkitSpeechRecognition VẪN tồn tại trên http, nên không được rơi vào
    // nhánh "trình duyệt chưa hỗ trợ" như trước.
    const { FakeRecognition } = makeFakeRecognition(null);
    const Page = await loadPage({ secure: false, ctor: FakeRecognition });

    // Act
    render(<Page />);

    // Assert
    expect(screen.getByText(/http:\/\/ nên trình duyệt chặn micro/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bấm để bắt đầu đọc/ })).not.toBeInTheDocument();
  });

  test('trình duyệt không có Web Speech API thì báo đúng lý do đó', async () => {
    // Arrange + Act
    const Page = await loadPage({ secure: true, ctor: undefined });
    render(<Page />);

    // Assert
    expect(screen.getByText(/chưa hỗ trợ nhận diện giọng nói/)).toBeInTheDocument();
  });
});
