import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Priority, ReminderSettings, RepeatFrequency, Task, TaskStatus, Theme } from '../types';
import { parseDueDate, shiftRepeatDate } from '../utils/date';

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
  addTask: (input: NewTaskInput) => Task;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  applyOrder: (orderedByStatus: Record<TaskStatus, string[]>) => void;
  promoteStartedTasks: () => void;
  toggleDone: (id: string) => void;
  /** 完成任务；若任务设置了重复，自动生成下一周期副本（待处理、日期顺延）并返回副本 */
  completeRecurring: (id: string) => Task | null;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
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

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set) => ({
      tasks: [],
      reminderSettings: DEFAULT_REMINDER_SETTINGS,
      theme: 'dark',

      addTask: (input) => {
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
        set((state) => ({ tasks: [task, ...state.tasks] }));
        return task;
      },

      updateTask: (id, updates) =>
        set((state) => {
          const now = Date.now();
          const tasks: Task[] = state.tasks.map((task): Task => {
            if (task.id !== id) return task;
            const merged = { ...task, ...updates };
            let status = merged.status;
            const start = parseDueDate(merged.startDate);
            if (status === 'todo' && start !== null && start.getTime() <= now) {
              status = 'in-progress';
            }
            return { ...merged, status, updatedAt: now };
          });
          return { tasks };
        }),

      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

      applyOrder: (orderedByStatus) =>
        set((state) => {
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
          return { tasks: next };
        }),

      promoteStartedTasks: () =>
        set((state) => {
          const now = Date.now();
          let changed = false;
          const tasks: Task[] = state.tasks.map((task): Task => {
            if (task.status === 'todo' && task.startDate !== '') {
              const start = parseDueDate(task.startDate);
              if (start !== null && start.getTime() <= now) {
                changed = true;
                return { ...task, status: 'in-progress', updatedAt: now };
              }
            }
            return task;
          });
          if (!changed) return state;
          return { tasks };
        }),

      toggleDone: (id) =>
        set((state) => {
          const now = Date.now();
          const tasks: Task[] = state.tasks.map((task): Task => {
            if (task.id !== id) return task;
            if (task.status === 'done') {
              const started = task.startDate !== '' && (parseDueDate(task.startDate)?.getTime() ?? 0) <= now;
              return { ...task, status: started ? 'in-progress' : 'todo', updatedAt: now };
            }
            return { ...task, status: 'done', updatedAt: now };
          });
          return { tasks };
        }),

      // 完成任务并生成下一周期副本。副本保留标题/描述/优先级/重复设置，
      // 开始与截止时间各顺延一个周期；原任务标记为已完成。
      completeRecurring: (id) => {
        const state = useTaskStore.getState();
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
        set((prev) => ({
          tasks: [
            ...prev.tasks.map((t): Task => (t.id === id ? { ...t, status: 'done', updatedAt: now } : t)),
            next,
          ],
        }));
        return next;
      },

      archiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task): Task =>
            task.id === id ? { ...task, archived: true, updatedAt: Date.now() } : task,
          ),
        })),

      unarchiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task): Task =>
            task.id === id ? { ...task, archived: false, updatedAt: Date.now() } : task,
          ),
        })),

      updateReminderSettings: (updates) =>
        set((state) => ({ reminderSettings: { ...state.reminderSettings, ...updates } })),

      recordReminderSent: (timestamp) =>
        set((state) => ({ reminderSettings: { ...state.reminderSettings, lastSentAt: timestamp } })),

      setTheme: (theme) => set({ theme }),
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