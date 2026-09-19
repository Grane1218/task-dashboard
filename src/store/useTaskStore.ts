import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Priority, ReminderSettings, RepeatFrequency, Task, TaskStatus, Theme } from '../types';
import { parseDueDate, shiftRepeatDate } from '../utils/date';
import { syncTaskOrder, upsertTask, removeTask, writeThrough, ensureCloud } from '../lib/cloud';
import { useToastStore } from './useToastStore';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  frequency: 'daily',
  time: '09:00',
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  lastSentAt: null,
};

export interface NewTaskInput {
  title: string;
  description: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  status?: TaskStatus;
  repeat?: RepeatFrequency;
}

interface TaskStoreState {
  tasks: Task[];
  reminderSettings: ReminderSettings;
  theme: Theme;
  addTask: (input: NewTaskInput) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  applyOrder: (orderedByStatus: Record<TaskStatus, string[]>) => Promise<boolean>;
  promoteStartedTasks: () => void;
  toggleDone: (id: string) => Promise<boolean>;
  /** 完成任务；若任务设置了重复，自动生成下一周期副本（待处理、日期顺延）并返回副本；云写失败返回 undefined */
  completeRecurring: (id: string) => Promise<Task | null | undefined>;
  archiveTask: (id: string) => Promise<boolean>;
  unarchiveTask: (id: string) => Promise<boolean>;
  updateReminderSettings: (updates: Partial<ReminderSettings>) => void;
  recordReminderSent: (timestamp: number) => void;
  setTheme: (theme: Theme) => void;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function syncFail(message: string): void {
  useToastStore.getState().addToast(message, 'error');
}

/** 任务数组变化后尽力同步一次云端 task-order（失败忽略，下次操作会再同步） */
async function refreshTaskOrder(tasks: Task[]): Promise<void> {
  if (!(await ensureCloud())) return;
  try {
    await syncTaskOrder(tasks);
  } catch {
    /* 顺序同步是尽力而为，失败由下一次 mutation 覆盖 */
  }
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      reminderSettings: DEFAULT_REMINDER_SETTINGS,
      theme: 'dark',

      addTask: async (input) => {
        const now = Date.now();
        // 开始时间已到的任务，创建后直接进入「进行中」
        let status = input.status ?? 'todo';
        const start = parseDueDate(input.startDate);
        if (start !== null && start.getTime() <= now) {
          status = 'in-progress';
        }
        const task: Task = {
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
        if (!(await writeThrough(() => upsertTask(task)))) {
          syncFail('同步失败，任务未保存');
          return null;
        }
        set((state) => ({ tasks: [task, ...state.tasks] }));
        void refreshTaskOrder(get().tasks);
        return task;
      },

      updateTask: async (id, updates) => {
        const now = Date.now();
        const existing = get().tasks.find((task) => task.id === id);
        if (existing === undefined) return false;
        const merged = { ...existing, ...updates, updatedAt: now };
        let status = merged.status;
        const start = parseDueDate(merged.startDate);
        if (status === 'todo' && start !== null && start.getTime() <= now) {
          status = 'in-progress';
        }
        const finalTask: Task = { ...merged, status, updatedAt: now };
        if (!(await writeThrough(() => upsertTask(finalTask)))) {
          syncFail('同步失败，任务未更新');
          return false;
        }
        set((state) => ({
          tasks: state.tasks.map((task): Task => (task.id === id ? finalTask : task)),
        }));
        void refreshTaskOrder(get().tasks);
        return true;
      },

      deleteTask: async (id) => {
        if (!(await writeThrough(() => removeTask(id)))) {
          syncFail('同步失败，任务未删除');
          return false;
        }
        set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));
        void refreshTaskOrder(get().tasks);
        return true;
      },

      applyOrder: async (orderedByStatus) => {
        const state = get();
        const byId = new Map(state.tasks.map((task) => [task.id, task]));
        const statuses: TaskStatus[] = ['todo', 'in-progress', 'done'];
        const next: Task[] = [];
        for (const status of statuses) {
          const ids = orderedByStatus[status] ?? [];
          for (const id of ids) {
            const task = byId.get(id);
            if (!task) continue;
            next.push(task.status === status ? task : { ...task, status, updatedAt: Date.now() });
          }
        }
        // 先云后本地：状态发生变化的任务写文档，顺序结构一次性写入 task-order 单文档
        const statusChanged = next.filter((t) => t.status !== byId.get(t.id)?.status);
        const ok = await writeThrough(async () => {
          for (const t of statusChanged) {
            if (!(await upsertTask(t))) return false;
          }
          return syncTaskOrder(next);
        });
        if (!ok) {
          syncFail('同步失败，排序未保存');
          return false;
        }
        set({ tasks: next });
        return true;
      },

      promoteStartedTasks: () => {
        const now = Date.now();
        const state = get();
        const changed: Task[] = [];
        const tasks: Task[] = state.tasks.map((task): Task => {
          if (task.status === 'todo' && task.startDate !== '') {
            const start = parseDueDate(task.startDate);
            if (start !== null && start.getTime() <= now) {
              const next: Task = { ...task, status: 'in-progress', updatedAt: now };
              changed.push(next);
              return next;
            }
          }
          return task;
        });
        if (changed.length === 0) return;
        set({ tasks });
        // 时间推进触发的状态变更：本地立即生效，云端尽力同步（失败由下次操作覆盖）
        void (async () => {
          if (!(await ensureCloud())) return;
          for (const t of changed) {
            if (!(await upsertTask(t))) return;
          }
          void refreshTaskOrder(tasks);
        })();
      },

      toggleDone: async (id) => {
        const now = Date.now();
        const existing = get().tasks.find((task) => task.id === id);
        if (existing === undefined) return false;
        let nextStatus: TaskStatus;
        if (existing.status === 'done') {
          const started = existing.startDate !== '' && (parseDueDate(existing.startDate)?.getTime() ?? 0) <= now;
          nextStatus = started ? 'in-progress' : 'todo';
        } else {
          nextStatus = 'done';
        }
        const finalTask: Task = { ...existing, status: nextStatus, updatedAt: now };
        if (!(await writeThrough(() => upsertTask(finalTask)))) {
          syncFail('同步失败，任务状态未保存');
          return false;
        }
        set((state) => ({
          tasks: state.tasks.map((task): Task => (task.id === id ? finalTask : task)),
        }));
        void refreshTaskOrder(get().tasks);
        return true;
      },

      // 完成任务并生成下一周期副本。副本保留标题/描述/优先级/重复设置，
      // 开始与截止时间各顺延一个周期；原任务标记为已完成。
      completeRecurring: async (id) => {
        const state = get();
        const task = state.tasks.find((t) => t.id === id);
        if (task === undefined || task.status === 'done' || task.repeat === undefined) return null;

        const now = Date.now();
        const next: Task = {
          id: createId(),
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: 'todo',
          startDate: shiftRepeatDate(task.startDate, task.repeat),
          dueDate: shiftRepeatDate(task.dueDate, task.repeat),
          createdAt: now,
          updatedAt: now,
          repeat: task.repeat,
        };
        const doneTask: Task = { ...task, status: 'done', updatedAt: now };
        // 云写：先写副本再写原任务置 done（中途失败时云端至多残留一个 todo 副本，下次 hydrate 可收敛，不丢周期）
        const ok = await writeThrough(async () => {
          if (!(await upsertTask(next))) return false;
          return upsertTask(doneTask);
        });
        if (!ok) {
          syncFail('同步失败，任务未完成');
          return undefined;
        }
        set((prev) => ({
          tasks: [
            ...prev.tasks.map((t): Task => (t.id === id ? doneTask : t)),
            next,
          ],
        }));
        void refreshTaskOrder(get().tasks);
        return next;
      },

      archiveTask: async (id) => {
        const existing = get().tasks.find((task) => task.id === id);
        if (existing === undefined) return false;
        const finalTask: Task = { ...existing, archived: true, updatedAt: Date.now() };
        if (!(await writeThrough(() => upsertTask(finalTask)))) {
          syncFail('同步失败，任务未归档');
          return false;
        }
        set((state) => ({
          tasks: state.tasks.map((task): Task => (task.id === id ? finalTask : task)),
        }));
        void refreshTaskOrder(get().tasks);
        return true;
      },

      unarchiveTask: async (id) => {
        const existing = get().tasks.find((task) => task.id === id);
        if (existing === undefined) return false;
        const finalTask: Task = { ...existing, archived: false, updatedAt: Date.now() };
        if (!(await writeThrough(() => upsertTask(finalTask)))) {
          syncFail('同步失败，任务未恢复');
          return false;
        }
        set((state) => ({
          tasks: state.tasks.map((task): Task => (task.id === id ? finalTask : task)),
        }));
        void refreshTaskOrder(get().tasks);
        return true;
      },

      updateReminderSettings: (updates) =>
        // 本地立即生效；云端弱一致推送由 App 层统一监听后执行
        set((state) => ({ reminderSettings: { ...state.reminderSettings, ...updates } })),

      recordReminderSent: (timestamp) =>
        set((state) => ({ reminderSettings: { ...state.reminderSettings, lastSentAt: timestamp } })),

      setTheme: (theme) =>
        // 本地立即生效；云端弱一致推送由 App 层统一监听后执行
        set({ theme }),
    }),
    {
      name: 'task-dashboard-storage',
      version: 1,
      migrate: (persistedState, version) => {
        // 主题统一切到深色（Linear 风格），仅对旧版本数据生效一次
        if (version < 1 && persistedState !== null && typeof persistedState === 'object') {
          const obj = persistedState as Record<string, unknown>;
          const inner = obj.state && typeof obj.state === 'object' ? (obj.state as Record<string, unknown>) : obj;
          inner.theme = 'dark';
        }
        return persistedState as TaskStoreState;
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<TaskStoreState>) } as TaskStoreState;
        if (Array.isArray(merged.tasks)) {
          merged.tasks = merged.tasks.map((t) => ({
            ...t,
            startDate: typeof t.startDate === 'string' ? t.startDate : '',
            dueDate: typeof t.dueDate === 'string' ? t.dueDate : '',
            repeat:
              t.repeat === 'daily' || t.repeat === 'weekly' || t.repeat === 'monthly' ? t.repeat : undefined,
            archived: t.archived === true,
          }));
        }
        return merged;
      },
    },
  ),
);

