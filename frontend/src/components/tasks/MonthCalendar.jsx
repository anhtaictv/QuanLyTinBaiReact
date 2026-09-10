import React from 'react';
import { buildMonthGrid, toDateKey, isSameMonth, WEEKDAY_LABELS } from '../../utils/taskDates';
import { isOverdue, STATUS_COLORS } from '../../utils/taskStatus';
import { IconChevronLeft, IconChevronRight } from '../icons';

const MAX_CHIPS_PER_DAY = 2; // hơn nữa thì ô ngày cao lệch nhau, xem chi tiết ở danh sách bên dưới

const navBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer'
};

// Lịch tháng tự vẽ bằng CSS grid — dự án không dùng thư viện UI ngoài (icon cũng tự vẽ
// SVG), kéo cả react-big-calendar về chỉ để hiện 42 ô là không đáng.
const MonthCalendar = ({ year, month, tasksByDay, selectedKey, onSelectDay, onChangeMonth }) => {
  const grid = buildMonthGrid(year, month);
  const todayKey = toDateKey(new Date());
  const monthLabel = new Date(year, month, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => onChangeMonth(-1)} style={navBtn} aria-label="Tháng trước"><IconChevronLeft size={16} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 15, textTransform: 'capitalize' }}>{monthLabel}</strong>
          <button onClick={() => onChangeMonth(0)} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: 12.5 }}>Hôm nay</button>
        </div>
        <button onClick={() => onChangeMonth(1)} style={navBtn} aria-label="Tháng sau"><IconChevronRight size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {WEEKDAY_LABELS.map(label => (
          <div key={label} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4 }}>
            {label}
          </div>
        ))}

        {grid.map(date => {
          const key = toDateKey(date);
          const dayTasks = tasksByDay.get(key) || [];
          const inMonth = isSameMonth(date, year, month);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              aria-label={`Ngày ${date.getDate()}, ${dayTasks.length} việc`}
              aria-pressed={isSelected}
              style={{
                display: 'flex', flexDirection: 'column', gap: 3, minHeight: 74, padding: 5,
                textAlign: 'left', cursor: 'pointer', font: 'inherit',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                borderRadius: 'var(--radius-sm)',
                // Ngày của tháng khác vẫn hiện (để tuần không bị đứt) nhưng làm mờ đi.
                opacity: inMonth ? 1 : 0.45
              }}
            >
              <span style={{
                fontSize: 12.5, fontWeight: isToday ? 800 : 600,
                color: isToday ? 'var(--accent)' : 'var(--text)'
              }}>
                {date.getDate()}
              </span>

              {dayTasks.slice(0, MAX_CHIPS_PER_DAY).map(task => {
                const overdue = isOverdue(task);
                const color = STATUS_COLORS[task.Status] || STATUS_COLORS.pending;
                return (
                  <span key={task.TaskID} title={task.Title} style={{
                    fontSize: 10.5, lineHeight: 1.3, padding: '1px 4px', borderRadius: 4,
                    background: overdue ? 'var(--danger-soft)' : color.bg,
                    color: overdue ? 'var(--danger)' : color.fg,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {task.Title}
                  </span>
                );
              })}

              {dayTasks.length > MAX_CHIPS_PER_DAY && (
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  +{dayTasks.length - MAX_CHIPS_PER_DAY} việc nữa
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
