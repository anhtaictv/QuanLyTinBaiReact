import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock lớp axios dùng chung để kiểm tra ĐÚNG những gì aiService gửi đi, không gọi mạng thật.
vi.mock('./api', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { text: '' } })) }
}));

import api from './api';
import { transcribeAudio } from './aiService';

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
