import { describe, it, expect } from 'vitest';
import {
  toDateKey, buildMonthGrid, monthRange, taskDateKey, groupTasksByDay, isSameMonth, toDateTimeLocalValue
} from './taskDates';

describe('toDateKey', () => {
  it('lấy ngày theo giờ địa phương, không lệch múi giờ', () => {
    // 7h sáng giờ VN = 0h UTC cùng ngày; nếu dùng toISOString() sẽ ra đúng, nhưng
    // 1h sáng giờ VN thì UTC vẫn là hôm trước — trường hợp này mới bắt được lỗi.
    const oneAm = new Date(2026, 8, 8, 1, 0, 0); // 08/09/2026 01:00 giờ máy
    expect(toDateKey(oneAm)).toBe('2026-09-08');
  });

  it('trả chuỗi rỗng khi giá trị không phải ngày hợp lệ', () => {
    expect(toDateKey('không phải ngày')).toBe('');
  });
});

describe('buildMonthGrid', () => {
  it('luôn trả về 42 ô để lịch không nhảy chiều cao giữa các tháng', () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(42);
  });

  it('ô đầu tiên luôn là Thứ 2', () => {
    // Tháng 9/2026 mùng 1 rơi vào Thứ 3 -> lưới phải lùi về Thứ 2 ngày 31/8.
    const grid = buildMonthGrid(2026, 8);
    expect(grid[0].getDay()).toBe(1);
    expect(toDateKey(grid[0])).toBe('2026-08-31');
  });

  it('xử lý đúng tháng bắt đầu bằng Chủ nhật (phải lùi trọn 6 ngày)', () => {
    // 01/11/2026 là Chủ nhật.
    const grid = buildMonthGrid(2026, 10);
    expect(toDateKey(grid[0])).toBe('2026-10-26');
    expect(grid[0].getDay()).toBe(1);
  });

  it('phủ hết ngày cuối tháng', () => {
    const grid = buildMonthGrid(2026, 8);
    const keys = grid.map(toDateKey);
    expect(keys).toContain('2026-09-30');
  });
});

describe('monthRange', () => {
  it('from là đầu tháng, to là đầu tháng kế tiếp', () => {
    const { from, to } = monthRange(2026, 8);
    expect(new Date(from).getMonth()).toBe(8);
    expect(new Date(from).getDate()).toBe(1);
    expect(new Date(to).getMonth()).toBe(9);
    expect(new Date(to).getDate()).toBe(1);
  });

  it('bắc cầu sang năm sau khi đang ở tháng 12', () => {
    const { to } = monthRange(2026, 11);
    expect(new Date(to).getFullYear()).toBe(2027);
    expect(new Date(to).getMonth()).toBe(0);
  });
});

describe('taskDateKey', () => {
  it('xếp theo hạn hoàn thành khi có hạn', () => {
    const task = { DueAt: new Date(2026, 8, 10, 9).toISOString(), AssignedAt: new Date(2026, 8, 1).toISOString() };
    expect(taskDateKey(task)).toBe('2026-09-10');
  });

  it('việc chưa đặt hạn thì xếp vào ngày được giao, không bị rơi khỏi lịch', () => {
    const task = { DueAt: null, AssignedAt: new Date(2026, 8, 3, 15).toISOString() };
    expect(taskDateKey(task)).toBe('2026-09-03');
  });
});

describe('groupTasksByDay', () => {
  it('gom nhiều việc cùng ngày vào một ô', () => {
    // Arrange
    const tasks = [
      { TaskID: 1, DueAt: new Date(2026, 8, 10, 9).toISOString() },
      { TaskID: 2, DueAt: new Date(2026, 8, 10, 17).toISOString() },
      { TaskID: 3, DueAt: new Date(2026, 8, 11, 8).toISOString() }
    ];

    // Act
    const grouped = groupTasksByDay(tasks);

    // Assert
    expect(grouped.get('2026-09-10')).toHaveLength(2);
    expect(grouped.get('2026-09-11')).toHaveLength(1);
  });

  it('bỏ qua bản ghi không có mốc thời gian nào thay vì tạo ô rỗng', () => {
    const grouped = groupTasksByDay([{ TaskID: 9, DueAt: null, AssignedAt: null }]);
    expect(grouped.size).toBe(0);
  });

  it('trả về map rỗng khi không có việc nào', () => {
    expect(groupTasksByDay().size).toBe(0);
  });
});

describe('isSameMonth', () => {
  it('phân biệt được ngày của tháng khác tràn vào lưới', () => {
    expect(isSameMonth(new Date(2026, 8, 15), 2026, 8)).toBe(true);
    expect(isSameMonth(new Date(2026, 7, 31), 2026, 8)).toBe(false);
  });
});

describe('toDateTimeLocalValue', () => {
  it('ra đúng định dạng input datetime-local theo giờ địa phương', () => {
    expect(toDateTimeLocalValue(new Date(2026, 8, 8, 9, 5))).toBe('2026-09-08T09:05');
  });

  it('trả rỗng khi không có hạn', () => {
    expect(toDateTimeLocalValue(null)).toBe('');
  });
});
