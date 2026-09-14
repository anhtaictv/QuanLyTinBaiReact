const test = require('node:test');
const assert = require('node:assert/strict');
const {
    TASK_STATUSES,
    isValidStatus,
    timestampsForStatus,
    isOverdue
} = require('../utils/taskStatus');

test('isValidStatus: chỉ nhận đúng 3 mã trạng thái', () => {
    for (const status of TASK_STATUSES) assert.equal(isValidStatus(status), true);
    assert.equal(isValidStatus('done'), true);
    assert.equal(isValidStatus('hoàn thành'), false, 'nhãn tiếng Việt là của giao diện, không phải mã lưu DB');
    assert.equal(isValidStatus('cancelled'), false);
    assert.equal(isValidStatus(''), false);
    assert.equal(isValidStatus(undefined), false);
});

test('timestampsForStatus: chuyển sang "đang làm" thì đóng dấu giờ bắt đầu, chưa có giờ hoàn thành', () => {
    // Arrange
    const now = new Date('2026-09-08T03:00:00Z');
    const current = { StartedAt: null, CompletedAt: null };

    // Act
    const stamps = timestampsForStatus('in_progress', current, now);

    // Assert
    assert.deepEqual(stamps, { StartedAt: now, CompletedAt: null });
});

test('timestampsForStatus: giữ nguyên giờ bắt đầu cũ khi bấm lại "đang làm"', () => {
    const started = new Date('2026-09-01T01:00:00Z');
    const now = new Date('2026-09-08T03:00:00Z');

    const stamps = timestampsForStatus('in_progress', { StartedAt: started, CompletedAt: null }, now);

    assert.equal(stamps.StartedAt, started, 'bấm lại không được dời mốc bắt đầu đã có');
});

test('timestampsForStatus: hoàn thành thẳng từ "chưa làm" vẫn có giờ bắt đầu', () => {
    const now = new Date('2026-09-08T03:00:00Z');

    const stamps = timestampsForStatus('done', { StartedAt: null, CompletedAt: null }, now);

    // Việc nhỏ làm xong trong một nốt nhạc thì không ai bấm "đang làm" giữa chừng; để
    // trống StartedAt sẽ khiến báo cáo thời gian xử lý bị rỗng.
    assert.equal(stamps.StartedAt, now);
    assert.equal(stamps.CompletedAt, now);
});

test('timestampsForStatus: trả về "chưa làm" thì xoá sạch cả hai mốc', () => {
    const now = new Date('2026-09-08T03:00:00Z');
    const current = { StartedAt: new Date('2026-09-01T01:00:00Z'), CompletedAt: new Date('2026-09-02T01:00:00Z') };

    const stamps = timestampsForStatus('pending', current, now);

    assert.deepEqual(stamps, { StartedAt: null, CompletedAt: null });
});

test('timestampsForStatus: từ chối mã trạng thái lạ', () => {
    assert.throws(() => timestampsForStatus('xong roi', {}, new Date()), /trạng thái/i);
});

test('isOverdue: quá hạn khi còn dang dở và đã qua hạn', () => {
    const now = new Date('2026-09-08T03:00:00Z');
    const due = new Date('2026-09-07T10:00:00Z');

    assert.equal(isOverdue({ Status: 'pending', DueAt: due }, now), true);
    assert.equal(isOverdue({ Status: 'in_progress', DueAt: due }, now), true);
});

test('isOverdue: việc đã hoàn thành không bị coi là trễ, kể cả nộp muộn', () => {
    const now = new Date('2026-09-08T03:00:00Z');

    assert.equal(isOverdue({ Status: 'done', DueAt: new Date('2026-09-07T10:00:00Z') }, now), false);
});

test('isOverdue: việc không đặt hạn thì không bao giờ trễ', () => {
    const now = new Date('2026-09-08T03:00:00Z');

    assert.equal(isOverdue({ Status: 'pending', DueAt: null }, now), false);
});

test('isOverdue: chưa tới hạn thì chưa trễ', () => {
    const now = new Date('2026-09-08T03:00:00Z');

    assert.equal(isOverdue({ Status: 'pending', DueAt: new Date('2026-09-09T10:00:00Z') }, now), false);
});
