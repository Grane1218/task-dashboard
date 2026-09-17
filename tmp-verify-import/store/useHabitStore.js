"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useHabitStore = exports.DEFAULT_HABIT_REMINDER_SETTINGS = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
exports.DEFAULT_HABIT_REMINDER_SETTINGS = {
    enabled: false,
    time: '09:00',
    quietEnabled: false,
    quietStart: '22:00',
    quietEnd: '08:00',
    lastSentAt: null,
};
function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}
exports.useHabitStore = (0, zustand_1.create)()((0, middleware_1.persist)((set) => ({
    templates: [],
    completions: {},
    reminderSettings: exports.DEFAULT_HABIT_REMINDER_SETTINGS,
    addTemplate: (input) => {
        const template = {
            id: createId(),
            title: input.title,
            emoji: input.emoji?.trim() === '' ? undefined : input.emoji?.trim(),
            category: input.category?.trim() === '' ? undefined : input.category?.trim(),
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ templates: [...state.templates, template] }));
        return template;
    },
    updateTemplate: (id, updates) => set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
    deleteTemplate: (id) => set((state) => {
        const completions = {};
        for (const key of Object.keys(state.completions)) {
            const ids = state.completions[key].filter((x) => x !== id);
            if (ids.length > 0)
                completions[key] = ids;
        }
        return { templates: state.templates.filter((t) => t.id !== id), completions };
    }),
    archiveTemplate: (id) => set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, archived: true } : t)),
    })),
    unarchiveTemplate: (id) => set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, archived: false } : t)),
    })),
    toggleCompletion: (templateId, date) => set((state) => {
        const day = state.completions[date] ?? [];
        const has = day.includes(templateId);
        const next = has ? day.filter((x) => x !== templateId) : [...day, templateId];
        return { completions: { ...state.completions, [date]: next } };
    }),
    setCompleted: (templateId, date, done) => set((state) => {
        const day = state.completions[date] ?? [];
        const has = day.includes(templateId);
        if (has === done)
            return state;
        const next = done ? [...day, templateId] : day.filter((x) => x !== templateId);
        return { completions: { ...state.completions, [date]: next } };
    }),
    updateReminderSettings: (updates) => set((state) => ({ reminderSettings: { ...state.reminderSettings, ...updates } })),
    recordReminderSent: (timestamp) => set((state) => ({ reminderSettings: { ...state.reminderSettings, lastSentAt: timestamp } })),
}), { name: 'daily-habit-storage', version: 1, migrate: (persistedState, _version) => {
        // 与任务 store 对齐：建立版本迁移机制，为后续字段变更提供兜底路径。
        // 当前为 v1，仅做结构兜底（templates 必须是数组、completions 必须是对象）。
        if (persistedState === null || typeof persistedState !== 'object')
            return persistedState;
        const obj = persistedState;
        const inner = obj.state && typeof obj.state === 'object' ? obj.state : obj;
        if (!Array.isArray(inner.templates))
            inner.templates = [];
        if (inner.completions === null || typeof inner.completions !== 'object' || Array.isArray(inner.completions)) {
            inner.completions = {};
        }
        return persistedState;
    } }));
