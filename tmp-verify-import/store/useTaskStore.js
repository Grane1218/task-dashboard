"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTaskStore = exports.DEFAULT_REMINDER_SETTINGS = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const date_1 = require("../utils/date");
exports.DEFAULT_REMINDER_SETTINGS = {
    enabled: false,
    frequency: 'daily',
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
exports.useTaskStore = (0, zustand_1.create)()((0, middleware_1.persist)((set) => ({
    tasks: [],
    reminderSettings: exports.DEFAULT_REMINDER_SETTINGS,
    theme: 'dark',
    addTask: (input) => {
        const now = Date.now();
        // 开始时间已到的任务，创建后直接进入「进行中」
        let status = input.status ?? 'todo';
        const start = (0, date_1.parseDueDate)(input.startDate);
        if (start !== null && start.getTime() <= now) {
            status = 'in-progress';
        }
        const task = {
            id: createId(),
            title: input.title,
            description: input.description,
            priority: input.priority,
            status,
            startDate: input.startDate,
            dueDate: input.dueDate,
            createdAt: now,
            updatedAt: now,
            repeat: input.repeat,
        };
        set((state) => ({ tasks: [task, ...state.tasks] }));
        return task;
    },
    updateTask: (id, updates) => set((state) => {
        const now = Date.now();
        const tasks = state.tasks.map((task) => {
            if (task.id !== id)
                return task;
            const merged = { ...task, ...updates };
            let status = merged.status;
            const start = (0, date_1.parseDueDate)(merged.startDate);
            if (status === 'todo' && start !== null && start.getTime() <= now) {
                status = 'in-progress';
            }
            return { ...merged, status, updatedAt: now };
        });
        return { tasks };
    }),
    deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
    applyOrder: (orderedByStatus) => set((state) => {
        const byId = new Map(state.tasks.map((task) => [task.id, task]));
        const statuses = ['todo', 'in-progress', 'done'];
        const next = [];
        for (const status of statuses) {
            const ids = orderedByStatus[status] ?? [];
            for (const id of ids) {
                const task = byId.get(id);
                if (!task)
                    continue;
                next.push(task.status === status ? task : { ...task, status, updatedAt: Date.now() });
            }
        }
        return { tasks: next };
    }),
    promoteStartedTasks: () => set((state) => {
        const now = Date.now();
        let changed = false;
        const tasks = state.tasks.map((task) => {
            if (task.status === 'todo' && task.startDate !== '') {
                const start = (0, date_1.parseDueDate)(task.startDate);
                if (start !== null && start.getTime() <= now) {
                    changed = true;
                    return { ...task, status: 'in-progress', updatedAt: now };
                }
            }
            return task;
        });
        if (!changed)
            return state;
        return { tasks };
    }),
    toggleDone: (id) => set((state) => {
        const now = Date.now();
        const tasks = state.tasks.map((task) => {
            if (task.id !== id)
                return task;
            if (task.status === 'done') {
                const started = task.startDate !== '' && ((0, date_1.parseDueDate)(task.startDate)?.getTime() ?? 0) <= now;
                return { ...task, status: started ? 'in-progress' : 'todo', updatedAt: now };
            }
            return { ...task, status: 'done', updatedAt: now };
        });
        return { tasks };
    }),
    // 完成任务并生成下一周期副本。副本保留标题/描述/优先级/重复设置，
    // 开始与截止时间各顺延一个周期；原任务标记为已完成。
    completeRecurring: (id) => {
        const state = exports.useTaskStore.getState();
        const task = state.tasks.find((t) => t.id === id);
        if (task === undefined || task.status === 'done' || task.repeat === undefined)
            return null;
        const now = Date.now();
        const next = {
            id: createId(),
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'todo',
            startDate: (0, date_1.shiftRepeatDate)(task.startDate, task.repeat),
            dueDate: (0, date_1.shiftRepeatDate)(task.dueDate, task.repeat),
            createdAt: now,
            updatedAt: now,
            repeat: task.repeat,
        };
        set((prev) => ({
            tasks: [
                ...prev.tasks.map((t) => (t.id === id ? { ...t, status: 'done', updatedAt: now } : t)),
                next,
            ],
        }));
        return next;
    },
    archiveTask: (id) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id ? { ...task, archived: true, updatedAt: Date.now() } : task),
    })),
    unarchiveTask: (id) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id ? { ...task, archived: false, updatedAt: Date.now() } : task),
    })),
    updateReminderSettings: (updates) => set((state) => ({ reminderSettings: { ...state.reminderSettings, ...updates } })),
    recordReminderSent: (timestamp) => set((state) => ({ reminderSettings: { ...state.reminderSettings, lastSentAt: timestamp } })),
    setTheme: (theme) => set({ theme }),
}), {
    name: 'task-dashboard-storage',
    version: 1,
    migrate: (persistedState, version) => {
        // 主题统一切到深色（Linear 风格），仅对旧版本数据生效一次
        if (version < 1 && persistedState !== null && typeof persistedState === 'object') {
            const obj = persistedState;
            const inner = obj.state && typeof obj.state === 'object' ? obj.state : obj;
            inner.theme = 'dark';
        }
        return persistedState;
    },
    merge: (persisted, current) => {
        const merged = { ...current, ...persisted };
        if (Array.isArray(merged.tasks)) {
            merged.tasks = merged.tasks.map((t) => ({
                ...t,
                startDate: typeof t.startDate === 'string' ? t.startDate : '',
                dueDate: typeof t.dueDate === 'string' ? t.dueDate : '',
                repeat: t.repeat === 'daily' || t.repeat === 'weekly' || t.repeat === 'monthly' ? t.repeat : undefined,
                archived: t.archived === true,
            }));
        }
        return merged;
    },
}));
