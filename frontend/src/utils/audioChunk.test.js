import { describe, expect, test } from 'vitest';
import {
  SEGMENT_SECONDS,
  encodeWavMono,
  formatDuration,
  needsSplitting,
  planSegments,
  stripExtension
} from './audioChunk';

describe('planSegments', () => {
  test('trả một đoạn duy nhất khi băng ngắn hơn trần', () => {
    // Arrange
    const duration = 12;

    // Act
    const segments = planSegments(duration);

    // Assert
    expect(segments).toEqual([{ index: 0, start: 0, end: 12 }]);
  });

  test('cắt băng dài thành các đoạn liên tiếp không chồng lấn và không hở', () => {
    // Arrange
    const duration = 200;

    // Act
    const segments = planSegments(duration, 25);

    // Assert
    expect(segments).toHaveLength(8);
    expect(segments[0]).toEqual({ index: 0, start: 0, end: 25 });
    expect(segments.at(-1)).toEqual({ index: 7, start: 175, end: 200 });
    segments.slice(1).forEach((segment, i) => {
      expect(segment.start).toBe(segments[i].end);
    });
  });

  test('đoạn cuối bị cắt ngắn theo đúng thời lượng thật của băng', () => {
    // Arrange
    const duration = 63;

    // Act
    const segments = planSegments(duration, 25);

    // Assert
    expect(segments).toHaveLength(3);
    expect(segments.at(-1)).toEqual({ index: 2, start: 50, end: 63 });
  });

  test('không sinh đoạn dư siêu ngắn do sai số làm tròn', () => {
    // Arrange — 50.0000001s chia 25s về mặt số học ra 3 đoạn, đoạn cuối dài 1e-7 giây
    const duration = 50.0000001;

    // Act
    const segments = planSegments(duration, 25);

    // Assert
    expect(segments).toHaveLength(2);
  });

  test('mọi đoạn đều không vượt trần đã cho', () => {
    // Arrange
    const duration = 187.4;

    // Act
    const segments = planSegments(duration, SEGMENT_SECONDS);

    // Assert
    segments.forEach(({ start, end }) => {
      expect(end - start).toBeLessThanOrEqual(SEGMENT_SECONDS);
    });
  });

  test('vẫn giữ một đoạn cho file cực ngắn thay vì trả rỗng', () => {
    // Arrange
    const duration = 0.1;

    // Act
    const segments = planSegments(duration, 25);

    // Assert
    expect(segments).toEqual([{ index: 0, start: 0, end: 0.1 }]);
  });

  test('trả mảng rỗng khi thời lượng không dùng được', () => {
    // Arrange & Act & Assert
    expect(planSegments(0)).toEqual([]);
    expect(planSegments(-5)).toEqual([]);
    expect(planSegments(Infinity)).toEqual([]);
    expect(planSegments(undefined)).toEqual([]);
  });

  test('dùng trần mặc định khi truyền segmentSeconds không hợp lệ', () => {
    // Arrange & Act
    const segments = planSegments(60, 0);

    // Assert
    expect(segments[0].end).toBe(SEGMENT_SECONDS);
  });
});

describe('needsSplitting', () => {
  test('không cắt khi băng ngắn hơn hoặc bằng trần', () => {
    expect(needsSplitting(10)).toBe(false);
    expect(needsSplitting(SEGMENT_SECONDS)).toBe(false);
  });

  test('cắt khi băng dài hơn trần', () => {
    expect(needsSplitting(SEGMENT_SECONDS + 0.5)).toBe(true);
  });

  test('cắt khi không đọc được thời lượng, vì gửi thẳng file dài sẽ chết ở upstream', () => {
    expect(needsSplitting(Infinity)).toBe(true);
    expect(needsSplitting(null)).toBe(true);
    expect(needsSplitting(NaN)).toBe(true);
  });
});

describe('encodeWavMono', () => {
  const readHeader = async (blob) => new DataView(await blob.arrayBuffer());
  const ascii = (view, offset, length) =>
    Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

  test('ghi header WAV PCM 16-bit mono đúng tần số lấy mẫu', async () => {
    // Arrange
    const samples = new Float32Array(8);

    // Act
    const view = await readHeader(encodeWavMono(samples, 16000));

    // Assert
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 12, 4)).toBe('fmt ');
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);      // PCM không nén
    expect(view.getUint16(22, true)).toBe(1);      // mono
    expect(view.getUint32(24, true)).toBe(16000);  // sample rate
    expect(view.getUint32(28, true)).toBe(32000);  // byte mỗi giây = 16000 * 1 * 2
    expect(view.getUint16(34, true)).toBe(16);     // bit mỗi mẫu
  });

  test('độ dài khối data khớp số mẫu và tổng kích thước file', async () => {
    // Arrange
    const samples = new Float32Array(100);

    // Act
    const blob = encodeWavMono(samples, 16000);
    const view = await readHeader(blob);

    // Assert
    expect(view.getUint32(40, true)).toBe(200);   // 100 mẫu x 2 byte
    expect(view.getUint32(4, true)).toBe(236);    // 36 + 200
    expect(blob.size).toBe(244);                  // 44 byte header + 200 byte data
  });

  test('kẹp mẫu vượt ±1 thay vì để tràn Int16 thành tiếng nổ', async () => {
    // Arrange — trộn kênh có thể đẩy mẫu ra ngoài ±1
    const samples = new Float32Array([1.8, -2.5, 0, 1, -1]);

    // Act
    const view = await readHeader(encodeWavMono(samples, 16000));

    // Assert
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
    expect(view.getInt16(48, true)).toBe(0);
    expect(view.getInt16(50, true)).toBe(32767);
    expect(view.getInt16(52, true)).toBe(-32767);
  });

  test('giữ đúng loại MIME audio/wav để backend nhận diện được', () => {
    expect(encodeWavMono(new Float32Array(4), 16000).type).toBe('audio/wav');
  });
});

describe('stripExtension', () => {
  test('bỏ đuôi file cuối cùng', () => {
    expect(stripExtension('phong-van.mp3')).toBe('phong-van');
    expect(stripExtension('bang.ghi.am.wav')).toBe('bang.ghi.am');
  });

  test('giữ nguyên tên không có đuôi', () => {
    expect(stripExtension('phongvan')).toBe('phongvan');
  });

  test('chịu được đầu vào rỗng hoặc null', () => {
    expect(stripExtension('')).toBe('');
    expect(stripExtension(null)).toBe('');
  });
});

describe('formatDuration', () => {
  test('hiển thị phút:giây có đệm 0', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(200)).toBe('3:20');
  });

  test('quy giá trị không dùng được về 0:00', () => {
    expect(formatDuration(-10)).toBe('0:00');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(undefined)).toBe('0:00');
  });
});
