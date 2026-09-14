// Phần lịch của module công việc: dựng lưới tháng và gom việc vào từng ngày.
// Mọi thứ ở đây tính theo giờ ĐỊA PHƯƠNG của người xem (backend lưu UTC) — nếu gom
// nhóm theo UTC thì việc đến hạn 7h sáng sẽ nhảy sang ô ngày hôm trước.
const DAYS_IN_WEEK = 7;
const WEEKS_IN_GRID = 6; // 6 hàng phủ được mọi tháng, kể cả tháng 31 ngày bắt đầu Chủ nhật

export const WEEKDAY_LABELS = Object.freeze(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);

// Khoá ngày dạng 'YYYY-MM-DD' theo giờ địa phương. Không dùng toISOString() vì hàm đó
// đổi sang UTC trước khi cắt chuỗi, lệch mất một ngày với múi giờ +07.
export const toDateKey = (value) => {
  // Phải chặn null/'' TRƯỚC khi dựng Date: new Date(null) không phải Invalid Date mà là
  // mốc 1970, nên việc thiếu ngày sẽ lặng lẽ rơi vào ô 01/01/1970 thay vì bị loại.
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

// Lịch Việt Nam bắt đầu từ Thứ 2; getDay() trả 0 cho Chủ nhật nên phải dời về cuối tuần.
const mondayOffset = (date) => (date.getDay() + 6) % DAYS_IN_WEEK;

// Trả về đúng 42 ngày liên tiếp, ngày đầu là Thứ 2 của tuần chứa mùng 1.
export const buildMonthGrid = (year, month) => {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayOffset(firstOfMonth));
  return Array.from(
    { length: DAYS_IN_WEEK * WEEKS_IN_GRID },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
};

// Khoảng thời gian gửi lên API cho một tháng: từ 0h ngày 1 tới 0h ngày 1 tháng sau
// (giờ địa phương, gửi đi dạng ISO nên backend nhận đúng mốc UTC tương ứng).
export const monthRange = (year, month) => ({
  from: new Date(year, month, 1).toISOString(),
  to: new Date(year, month + 1, 1).toISOString()
});

// Việc chưa đặt hạn vẫn phải nằm đâu đó trên lịch, nếu không người nhận không thấy nó
// tồn tại — xếp vào ngày được giao, khớp đúng luật lọc DATE_FILTER của backend.
export const taskDateKey = (task) => toDateKey(task?.DueAt || task?.AssignedAt);

export const groupTasksByDay = (tasks = []) => {
  const map = new Map();
  for (const task of tasks) {
    const key = taskDateKey(task);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return map;
};

export const isSameMonth = (date, year, month) =>
  date.getFullYear() === year && date.getMonth() === month;

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// Giá trị cho <input type="datetime-local">, cũng phải là giờ địa phương.
export const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
