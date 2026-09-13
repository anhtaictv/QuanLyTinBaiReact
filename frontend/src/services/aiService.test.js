import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock lớp axios dùng chung để kiểm tra ĐÚNG những gì aiService gửi đi, không gọi mạng thật.
vi.mock('./api', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { text: '' } })),
    get: vi.fn(() => Promise.resolve({ data: { voices: [] } }))
  }
}));

import api from './api';
import { transcribeAudio, listVoices, createVoice, synthesizeSpeech, synthesizeSpeechChunk } from './aiService';

const makeAudioFile = () => new File([new Uint8Array(8)], 'phong-van.wav', { type: 'audio/wav' });

describe('transcribeAudio', () => {
  beforeEach(() => {
    api.post.mockClear();
  });

  // Bug thật đã gặp: sidebar gọi fetch('/api/transcribe') trong khi router mount ở /api/ai,
  // nên endpoint đúng là /api/ai/transcribe — gọi sai thì tính năng chết hoàn toàn.
  test('gọi đúng /ai/transcribe, khớp với chỗ aiRoutes được mount', async () => {
    // Arrange
    const file = makeAudioFile();

    // Act
    await transcribeAudio(file);

    // Assert
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe('/ai/transcribe');
  });

  // Phải đi qua instance api (nơi interceptor gắn Authorization), vì /api/ai/* nằm sau
  // verifyToken — dùng fetch trực tiếp là ăn 401 "Không tìm thấy Token!".
  test('gửi file qua lớp api dùng chung để được gắn token', async () => {
    // Arrange
    const file = makeAudioFile();

    // Act
    await transcribeAudio(file);

    // Assert
    const body = api.post.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('file').name).toBe('phong-van.wav');
  });

  test('bỏ Content-Type để trình duyệt tự điền boundary của multipart', async () => {
    // Arrange & Act
    await transcribeAudio(makeAudioFile());

    // Assert — để 'application/json' mặc định của instance thì multer không parse ra file
    expect(api.post.mock.calls[0][2].headers['Content-Type']).toBeUndefined();
    expect('Content-Type' in api.post.mock.calls[0][2].headers).toBe(true);
  });

  test('chuyển tiếp signal để hủy được lượt rã băng đang chạy', async () => {
    // Arrange
    const controller = new AbortController();

    // Act
    await transcribeAudio(makeAudioFile(), { signal: controller.signal });

    // Assert
    expect(api.post.mock.calls[0][2].signal).toBe(controller.signal);
  });

  test('chạy được khi bên gọi không truyền tuỳ chọn nào', async () => {
    // Arrange & Act & Assert
    await expect(transcribeAudio(makeAudioFile())).resolves.toBeDefined();
    expect(api.post.mock.calls[0][2].signal).toBeUndefined();
  });
});

describe('listVoices', () => {
  beforeEach(() => api.get.mockClear());

  test('gọi đúng /ai/voices, khớp với chỗ aiRoutes được mount', async () => {
    await listVoices();
    expect(api.get).toHaveBeenCalledWith('/ai/voices');
  });
});

describe('createVoice', () => {
  beforeEach(() => api.post.mockClear());

  test('gửi name + file dạng multipart, bỏ Content-Type như transcribeAudio', async () => {
    const file = makeAudioFile();

    await createVoice('Giọng MC A', file);

    expect(api.post.mock.calls[0][0]).toBe('/ai/voices');
    const body = api.post.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('name')).toBe('Giọng MC A');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(api.post.mock.calls[0][2].headers['Content-Type']).toBeUndefined();
  });
});

describe('synthesizeSpeech', () => {
  beforeEach(() => api.post.mockClear());

  // responseType 'blob' là điều kiện bắt buộc: thiếu nó axios cố parse audio nhị phân
  // thành JSON và ném lỗi, xem PostDetail.jsx:handleDownloadFile cho ca tương tự.
  test('gọi /ai/speech với responseType blob để nhận về audio nhị phân', async () => {
    await synthesizeSpeech('Xin chào', 'abc123');

    expect(api.post.mock.calls[0][0]).toBe('/ai/speech');
    expect(api.post.mock.calls[0][1]).toEqual({ text: 'Xin chào', voice: 'abc123' });
    expect(api.post.mock.calls[0][2].responseType).toBe('blob');
  });
});

describe('synthesizeSpeechChunk', () => {
  beforeEach(() => {
    api.post.mockClear();
  });

  // Máy A chỉ có 1 GPU worker: 503 "đang bận" là chuyện thường khi 2 người cùng bấm đọc,
  // để nó làm hỏng cả lượt đọc thì bài dài không bao giờ đọc xong.
  test('thử lại đoạn bị từ chối vì máy đọc đang bận', async () => {
    // Arrange
    const busy = Object.assign(new Error('busy'), { response: { status: 503, headers: {} } });
    api.post.mockRejectedValueOnce(busy).mockResolvedValueOnce({ data: 'audio' });
    const waits = [];

    // Act
    const result = await synthesizeSpeechChunk('xin chào', 'v1', { wait: (ms) => { waits.push(ms); return Promise.resolve(); } });

    // Assert
    expect(result.data).toBe('audio');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([20000]);
  });

  test('chờ đúng số giây máy đọc báo trong Retry-After', async () => {
    // Arrange
    const busy = Object.assign(new Error('busy'), { response: { status: 503, headers: { 'retry-after': '45' } } });
    api.post.mockRejectedValueOnce(busy).mockResolvedValueOnce({ data: 'audio' });
    const waits = [];

    // Act
    await synthesizeSpeechChunk('xin chào', 'v1', { wait: (ms) => { waits.push(ms); return Promise.resolve(); } });

    // Assert
    expect(waits).toEqual([45000]);
  });

  test('không thử lại khi nội dung quá dài cho một lượt (504)', async () => {
    // Arrange
    const tooLong = Object.assign(new Error('timeout'), { response: { status: 504, headers: {} } });
    api.post.mockRejectedValue(tooLong);

    // Act & Assert
    await expect(synthesizeSpeechChunk('dài', 'v1', { wait: () => Promise.resolve() })).rejects.toThrow('timeout');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('trả lỗi sau khi đã thử đủ số lần mà máy vẫn bận', async () => {
    // Arrange
    const busy = Object.assign(new Error('busy'), { response: { status: 503, headers: {} } });
    api.post.mockRejectedValue(busy);

    // Act & Assert
    await expect(synthesizeSpeechChunk('x', 'v1', { attempts: 3, wait: () => Promise.resolve() })).rejects.toThrow('busy');
    expect(api.post).toHaveBeenCalledTimes(3);
  });
});
