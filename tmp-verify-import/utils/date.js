"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDueDate = parseDueDate;
exports.isDueToday = isDueToday;
exports.isOverdue = isOverdue;
exports.formatDate = formatDate;
exports.toDateTimeLocal = toDateTimeLocal;
exports.shiftRepeatDate = shiftRepeatDate;
// 解析时间。支持 "YYYY-MM-DDTHH:mm"（精确到分钟）；兼容旧数据 "YYYY-MM-DD"（按当天 00:00 处理）。
function parseDueDate(time) {
    const value = time ?? '';
    if (value === '')
        return null;
    const datePart = value.slice(0, 10);
    const parts = datePart.split('-');
    if (parts.length !== 3)
        return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    let hour = 0;
    let minute = 0;
    const timePart = value.slice(11);
    if (timePart.length >= 5) {
        const seg = timePart.split(':').map(Number);
        hour = seg[0] ?? 0;
        minute = seg[1] ?? 0;
    }
    return new Date(year, month, day, hour, minute);
}
function isDueToday(time) {
    const date = parseDueDate(time);
    if (date === null)
        return false;
    const now = new Date();
    return (date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate());
}
// 逾期判定（按自然日末计算，不精确到分钟）：
// - 有开始日期：开始日期的次日「自然日末」仍未完成 → 逾期（即开始后第 2 天 00:00 起标记）
// - 有截止日期：截止日期当天「自然日末」仍未完成 → 逾期（即截止后第 1 天 00:00 起标记）
// 今天截止/开始的任务在当天不会标逾期，避免「刚过截止时刻就变红」的误导。
function isOverdue(startDate, dueDate, status) {
    if (status === 'done')
        return false;
    const now = new Date();
    const start = parseDueDate(startDate);
    if (start !== null) {
        // 开始日期次日 24:00（即 +2 天的 00:00）为最后期限
        const startDeadline = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 2);
        if (startDeadline.getTime() <= now.getTime())
            return true;
    }
    const due = parseDueDate(dueDate);
    if (due !== null) {
        // 截止日期当天 24:00（即 +1 天的 00:00）为最后期限
        const dueDeadline = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
        if (dueDeadline.getTime() <= now.getTime())
            return true;
    }
    return false;
}
function formatDate(time) {
    const value = time ?? '';
    if (value === '')
        return '';
    const datePart = value.slice(0, 10);
    const parts = datePart.split('-');
    if (parts.length !== 3)
        return value;
    const timePart = value.slice(11);
    const timeText = timePart.length >= 5 ? ' ' + timePart.slice(0, 5) : '';
    return parts[0] + '/' + parts[1] + '/' + parts[2] + timeText;
}
// 转成 <input type="datetime-local"> 所需的 "YYYY-MM-DDTHH:mm" 格式
function toDateTimeLocal(time) {
    const value = time ?? '';
    if (value === '')
        return '';
    if (value.indexOf('T') >= 0)
        return value;
    return value + 'T00:00';
}
// 将时间按重复频率顺延一个周期，格式保持 "YYYY-MM-DDTHH:mm"（旧数据可为 "YYYY-MM-DD"，顺延后同样不带时刻）。
// 每月顺延按目标月实际天数截断（如 1/31 +1 月 → 2 月末），避免溢出到下下月。
function shiftRepeatDate(time, frequency) {
    const value = time ?? '';
    if (value === '')
        return '';
    const datePart = value.slice(0, 10);
    const parts = datePart.split('-');
    if (parts.length !== 3)
        return value;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    let next;
    if (frequency === 'monthly') {
        const firstOfTarget = new Date(year, month + 1, 1);
        const daysInTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
        next = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, daysInTarget));
    }
    else {
        next = new Date(year, month, day + (frequency === 'daily' ? 1 : 7));
    }
    const pad = (n) => String(n).padStart(2, '0');
    const date = next.getFullYear() + '-' + pad(next.getMonth() + 1) + '-' + pad(next.getDate());
    const timePart = value.slice(11);
    return timePart.length >= 5 ? date + 'T' + timePart.slice(0, 5) : date;
}
