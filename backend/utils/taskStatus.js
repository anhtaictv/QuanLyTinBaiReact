// Nguồn sự thật về trạng thái công việc cho module Lịch công việc.
// Mã lưu trong DB là ASCII; nhãn tiếng Việt nằm bên frontend (src/utils/taskStatus.js)
// để cột Status không bao giờ dính vấn đề dấu/collation lúc so khớp trong WHERE.
const TASK_STATUSES = Object.freeze(['pending', 'in_progress', 'done']);

const isValidStatus = (status) => TASK_STATUSES.includes(status);

// Mốc thời gian là hệ quả của trạng thái, không phải thứ client tự gửi lên — để client
// tự khai giờ bắt đầu/hoàn thành thì báo cáo tiến độ nói dối được.
function timestampsForStatus(status, current = {}, now = new Date()) {
    if (!isValidStatus(status)) {
        throw new Error(`Không nhận ra trạng thái "${status}". Dùng một trong: ${TASK_STATUSES.join(', ')}.`);
    }

    if (status === 'pending') return { StartedAt: null, CompletedAt: null };

    // Việc nhỏ thường được bấm thẳng sang "hoàn thành" mà không qua "đang làm". Nếu để
    // trống StartedAt thì cột thời gian xử lý rỗng, không tính được làm mất bao lâu.
    const startedAt = current.StartedAt || now;

    if (status === 'in_progress') return { StartedAt: startedAt, CompletedAt: null };

    return { StartedAt: startedAt, CompletedAt: current.CompletedAt || now };
}

// Việc đã xong thì thôi không bêu trễ nữa, kể cả khi nộp muộn — cái cần nhắc là việc
// còn dang dở mà đã quá hạn.
function isOverdue(task, now = new Date()) {
    if (!task?.DueAt || task.Status === 'done') return false;
    return new Date(task.DueAt).getTime() < now.getTime();
}

module.exports = { TASK_STATUSES, isValidStatus, timestampsForStatus, isOverdue };
