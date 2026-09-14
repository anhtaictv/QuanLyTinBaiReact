import React, { useEffect, useRef, useState } from 'react';
import { getUnreadErrorCount, getErrorLogs, markErrorRead, markAllErrorsRead } from '../services/errorLogService';
import { showToastError } from '../utils/Toast';
import { IconAlertTriangle } from './icons';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

const POLL_MS = 30 * 1000;
const PANEL_WIDTH = 360;

// Icon chuông báo lỗi — chỉ dùng cho Admin. Poll số lỗi chưa đọc từ
// dbo.ErrorLogs (ghi tự động ở backend mỗi khi 1 API trả lỗi 500),
// bấm vào xem danh sách chi tiết để biết chỗ nào cần sửa.
const ErrorBell = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevCountRef = useRef(0);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const pos = useDropdownPosition(open, buttonRef, PANEL_WIDTH);

  const fetchCount = async () => {
    try {
      const res = await getUnreadErrorCount();
      const newCount = res.data.count || 0;
      if (newCount > prevCountRef.current) {
        showToastError(`Có ${newCount - prevCountRef.current} lỗi hệ thống mới!`);
      }
      prevCountRef.current = newCount;
      setCount(newCount);
    } catch {
      // im lặng: không để lỗi của chính tính năng báo lỗi làm phiền màn hình
    }
  };

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openPanel = async () => {
    setOpen(prev => !prev);
    if (!open) {
      setLoading(true);
      try {
        const res = await getErrorLogs(false);
        setErrors(res.data || []);
      } catch {
        setErrors([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markErrorRead(id);
      setErrors(prev => prev.map(e => e.ErrorID === id ? { ...e, IsRead: true } : e));
      fetchCount();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllErrorsRead();
      setErrors(prev => prev.map(e => ({ ...e, IsRead: true })));
      prevCountRef.current = 0;
      setCount(0);
    } catch {}
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={openPanel}
        title="Lỗi hệ thống"
        aria-label="Lỗi hệ thống"
        style={{
          width: 34, height: 34, borderRadius: 'var(--radius-sm)',
          background: count > 0 ? 'var(--danger-soft)' : 'rgba(255,255,255,0.06)',
          border: count > 0 ? '1px solid var(--danger)' : '1px solid var(--sidebar-border)',
          color: count > 0 ? 'var(--danger)' : 'var(--sidebar-fg)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}
      >
        <IconAlertTriangle size={16} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--danger)', color: 'white',
            borderRadius: '999px', fontSize: '11px',
            minWidth: 16, height: 16, lineHeight: '16px',
            textAlign: 'center', fontWeight: 'bold', padding: '0 3px'
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 500,
          width: PANEL_WIDTH, maxWidth: 'calc(100vw - 16px)', maxHeight: 420, overflowY: 'auto',
          background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          padding: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Lỗi hệ thống</strong>
            {count > 0 && (
              <button onClick={handleMarkAllRead} style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 10 }}>Đang tải...</div>
          ) : errors.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 10 }}>Không có lỗi nào</div>
          ) : (
            errors.map(e => (
              <div key={e.ErrorID} style={{
                borderBottom: '1px solid var(--border)', padding: '8px 4px',
                opacity: e.IsRead ? 0.55 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(e.CreatedAt).toLocaleString('vi-VN')}
                  </span>
                  {!e.IsRead && (
                    <button onClick={() => handleMarkRead(e.ErrorID)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
                      Đã đọc
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {e.Method} {e.Path} {e.Source ? `· ${e.Source}` : ''}
                </div>
                <div style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>
                  {e.Message}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorBell;
