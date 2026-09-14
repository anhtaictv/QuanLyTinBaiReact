import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

// Không gọi mạng thật: trang chỉ cần service tồn tại để render, phần rã băng đã có
// test riêng ở utils/audioChunk.test.js và services/aiService.test.js.
vi.mock('../services/aiService', () => ({
  transcribeAudio: vi.fn(() => Promise.resolve({ data: { text: '' } }))
}));

import InterviewTranscribe from './InterviewTranscribe';
import { SEGMENT_SECONDS } from '../utils/audioChunk';

const setClipboard = (writeText) => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
};

describe('Trang Rã băng phỏng vấn', () => {
  test('render được thành trang độc lập, không cần prop nào', () => {
    // Arrange + Act — trang nằm trong route nên không có onClose/onInsert như bản sidebar cũ;
    // render trần là cách rẻ nhất bắt lỗi cú pháp JSX trước khi build.
    render(<InterviewTranscribe />);

    // Assert
    expect(screen.getByRole('heading', { name: /Rã băng phỏng vấn/ })).toBeInTheDocument();
  });

  test('nói rõ trần cắt đoạn đúng bằng hằng số thật, không phải số viết tay', () => {
    // Arrange + Act
    render(<InterviewTranscribe />);

    // Assert — chống trường hợp đổi SEGMENT_SECONDS mà chữ trên giao diện vẫn nói 25.
    expect(screen.getByText(new RegExp(`dài hơn ${SEGMENT_SECONDS} giây`))).toBeInTheDocument();
  });

  test('khóa nút Copy và Xóa khi chưa có chữ nào', () => {
    // Arrange + Act
    render(<InterviewTranscribe />);

    // Assert
    expect(screen.getByRole('button', { name: /Copy toàn bộ/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Xóa hết/ })).toBeDisabled();
  });

  test('có chữ thì mở khóa Copy, và Copy đẩy đúng nội dung ra clipboard', async () => {
    // Arrange
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard(writeText);
    render(<InterviewTranscribe />);
    const copyBtn = screen.getByRole('button', { name: /Copy toàn bộ/ });

    // Act
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  nội dung thử  ' } });
    fireEvent.click(copyBtn);

    // Assert — cắt khoảng trắng thừa trước khi copy, không bê nguyên cả phần đệm.
    expect(copyBtn).toBeEnabled();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('nội dung thử'));
  });

  test('clipboard bị chặn thì không văng lỗi, nút vẫn dùng lại được', async () => {
    // Arrange — trang mở qua http hoặc trình duyệt chặn quyền: writeText ném lỗi.
    const writeText = vi.fn(() => Promise.reject(new Error('blocked')));
    setClipboard(writeText);
    render(<InterviewTranscribe />);
    const copyBtn = screen.getByRole('button', { name: /Copy toàn bộ/ });

    // Act
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.click(copyBtn);

    // Assert
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(copyBtn).toBeEnabled();
  });

  test('Xóa hết dọn sạch ô chữ', () => {
    // Arrange
    render(<InterviewTranscribe />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'xoa di' } });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Xóa hết/ }));

    // Assert
    expect(box).toHaveValue('');
  });
});
