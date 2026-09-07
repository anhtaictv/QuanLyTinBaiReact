import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 500;

// Lưu nháp form vào localStorage để không mất bài khi mất mạng đột ngột giữa lúc soạn
// (thường xảy ra ở vùng sâu vùng xa). Chỉ áp dụng cho các trường text của form — KHÔNG
// lưu file .docx offline (File object không serialize được vào localStorage, và đây là
// quyết định phạm vi đã chốt: chỉ text field).
// ponytail: không có hàng đợi retry/tự gửi lại khi có mạng trở lại — chỉ lưu + khôi phục.
// Thêm khi có nhu cầu "gửi bài khi mất mạng thật" cụ thể (Service Worker Background Sync).
function useOfflineDraft(key, data, { skipIfEmpty = true } = {}) {
  const [restoredDraft, setRestoredDraft] = useState(null);
  const timeoutRef = useRef(null);

  // Chỉ đọc draft cũ 1 lần khi mount, không phụ thuộc data hiện tại (tránh đọc lại khi
  // component tự cập nhật data sau khi người dùng bấm "Khôi phục").
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setRestoredDraft(JSON.parse(raw));
    } catch { /* localStorage có thể bị chặn (private mode) — bỏ qua êm */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        const hasContent = Object.values(data).some(v => typeof v === 'string' && v.trim());
        if (skipIfEmpty && !hasContent) return;
        localStorage.setItem(key, JSON.stringify(data));
      } catch { /* quota đầy/private mode — bỏ qua êm, không phải tính năng cốt lõi */ }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [key, data, skipIfEmpty]);

  const clearDraft = () => {
    try { localStorage.removeItem(key); } catch { /* bỏ qua êm */ }
    setRestoredDraft(null);
  };

  const dismissDraft = () => setRestoredDraft(null);

  return { restoredDraft, clearDraft, dismissDraft };
}

export default useOfflineDraft;
