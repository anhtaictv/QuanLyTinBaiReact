import { describe, expect, test } from 'vitest';
import { SPEECH_CHUNK_CHARS, splitTextForSpeech } from './ttsChunk';

describe('splitTextForSpeech', () => {
  test('trả mảng rỗng khi không có nội dung', () => {
    // Arrange
    const text = '   \n  ';

    // Act
    const chunks = splitTextForSpeech(text);

    // Assert
    expect(chunks).toEqual([]);
  });

  test('giữ nguyên một đoạn khi nội dung ngắn hơn trần', () => {
    // Arrange
    const text = 'Xin chào, đây là bản tin buổi sáng.';

    // Act
    const chunks = splitTextForSpeech(text);

    // Assert
    expect(chunks).toEqual([text]);
  });

  test('cắt theo ranh giới câu chứ không cắt giữa chừng', () => {
    // Arrange
    const sentence = 'Hôm nay trời đẹp và gió nhẹ. ';
    const text = sentence.repeat(10).trim();

    // Act
    const chunks = splitTextForSpeech(text, 60);

    // Assert
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => expect(chunk.endsWith('.')).toBe(true));
  });

  test('không có đoạn nào vượt trần ký tự', () => {
    // Arrange
    const text = 'Câu ngắn. '.repeat(200).trim();

    // Act
    const chunks = splitTextForSpeech(text, 120);

    // Assert
    chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(120));
  });

  test('vẫn cắt được câu dài hơn trần mà không mất chữ', () => {
    // Arrange
    const text = 'a'.repeat(250);

    // Act
    const chunks = splitTextForSpeech(text, 100);

    // Assert
    expect(chunks.length).toBe(3);
    expect(chunks.join('')).toBe(text);
  });

  test('ghép lại đủ chữ của bản gốc dù đã cắt nhiều đoạn', () => {
    // Arrange
    const text = 'Đoạn một nói về kinh tế. Đoạn hai nói về xã hội!\n\nĐoạn ba nói về thể thao?';

    // Act
    const chunks = splitTextForSpeech(text, 30);

    // Assert
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(chunks.join(' '))).toBe(normalize(text));
  });

  test('trần mặc định nằm dưới mức gây timeout proxy 120 giây', () => {
    // Arrange & Act & Assert
    expect(SPEECH_CHUNK_CHARS).toBeLessThanOrEqual(1200);
  });
});
