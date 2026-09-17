"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPEAT_OPTIONS = exports.REPEAT_LABELS = exports.FREQUENCY_LABELS = exports.PRIORITY_LABELS = exports.STATUS_LABELS = void 0;
exports.STATUS_LABELS = {
    todo: '待处理',
    'in-progress': '进行中',
    done: '已完成',
};
exports.PRIORITY_LABELS = {
    high: '高',
    medium: '中',
    low: '低',
};
exports.FREQUENCY_LABELS = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
};
exports.REPEAT_LABELS = {
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
};
exports.REPEAT_OPTIONS = [
    { value: 'none', label: '不重复' },
    { value: 'daily', label: '每天' },
    { value: 'weekly', label: '每周' },
    { value: 'monthly', label: '每月' },
];
