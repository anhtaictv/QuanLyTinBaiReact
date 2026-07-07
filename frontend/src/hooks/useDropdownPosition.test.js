import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDropdownPosition } from './useDropdownPosition';

function makeTriggerRef(rect) {
  return { current: { getBoundingClientRect: () => rect } };
}

describe('useDropdownPosition', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = 1000;
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
  });

  it('trả về null khi panel đang đóng', () => {
    const ref = makeTriggerRef({ right: 500, bottom: 40 });
    const { result } = renderHook(() => useDropdownPosition(false, ref, 200));
    expect(result.current).toBeNull();
  });

  it('đặt panel ngay dưới nút, canh phải panel trùng cạnh phải nút', () => {
    const ref = makeTriggerRef({ right: 500, bottom: 40 });
    const { result } = renderHook(() => useDropdownPosition(true, ref, 200, 8));
    expect(result.current).toEqual({ top: 48, left: 300 });
  });

  it('kẹp về gap khi nút quá gần mép trái (không để left âm)', () => {
    const ref = makeTriggerRef({ right: 50, bottom: 40 });
    const { result } = renderHook(() => useDropdownPosition(true, ref, 200, 8));
    expect(result.current.left).toBe(8);
  });

  it('kẹp trong viewport khi nút quá gần mép phải (không tràn màn hình)', () => {
    const ref = makeTriggerRef({ right: 995, bottom: 40 });
    const { result } = renderHook(() => useDropdownPosition(true, ref, 200, 8));
    // window.innerWidth(1000) - panelWidth(200) - gap(8) = 792
    expect(result.current.left).toBe(792);
  });
});
