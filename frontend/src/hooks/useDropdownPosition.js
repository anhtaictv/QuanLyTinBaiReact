import { useCallback, useEffect, useState } from 'react';

// Tính vị trí panel dạng position:fixed dựa theo vị trí thật của nút bấm
// (thay vì neo left/right theo CSS), rồi kẹp trong viewport — đảm bảo dropdown
// không bao giờ tràn ra ngoài màn hình dù nút nằm ở đâu trong hàng icon
// (sidebar hẹp 260px, topbar mobile, hay có bao nhiêu nút khác đứng cạnh).
export function useDropdownPosition(open, triggerRef, panelWidth, gap = 8) {
  const [pos, setPos] = useState(null);

  const compute = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.right - panelWidth;
    left = Math.max(gap, Math.min(left, window.innerWidth - panelWidth - gap));
    const top = rect.bottom + gap;
    setPos({ top, left });
  }, [triggerRef, panelWidth, gap]);

  useEffect(() => {
    if (!open) return;
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, compute]);

  return pos;
}
