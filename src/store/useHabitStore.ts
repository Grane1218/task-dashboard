import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompletionMap, HabitReminderSettings, TaskTemplate } from '../types/habit';
import { upsertTemplate, removeTemplate, upsertCompletion, writeThrough } from '../lib/cloud';
import { useToastStore } from './useToastStore';

export const DEFAULT_HABIT_REMINDER_SETTINGS: HabitReminderSettings = {
  enabled: false,
  time: '09:00',
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  lastSentAt: null,
};

interface HabitStoreState {
  templates: TaskTemplate[];
  completions: CompletionMap;
  reminderSettings: HabitReminderSettings;
  addTemplate: (input: { title: string; emoji?: string; category?: string }) => Promise<TaskTemplate | null>;
  updateTemplate: (id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  archiveTemplate: (id: string) => Promise<boolean>;
  unarchiveTemplate: (id: string) => Promise<boolean>;
  toggleCompletion: (templateId: string, date: string) => Promise<boolean>;
  setCompleted: (templateId: string, date: string, done: boolean) => Promise<boolean>;
  updateReminderSettings: (updates: Partial<HabitReminderSettings>) => void;
  recordReminderSent: (timestamp: number) => void;
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

export const useHabitStore = create<HabitStoreState>()(
  persist(
    (set, get) => ({
      templates: [],
      completions: {},
      reminderSettings: DEFAULT_HABIT_REMINDER_SETTINGS,

      addTemplate: async (input) => {
        const template: TaskTemplate = {
          id: createId(),
          title: input.title,
          emoji: input.emoji?.trim() === '' ? undefined : input.emoji?.trim(),
          category: input.category?.trim() === '' ? undefined : input.category?.trim(),
          createdAt: new Date().toISOString(),
        };
        if (!(await writeThrough(() => upsertTemplate(template)))) {
          syncFail('同步失败，习惯未添加');
          return null;
        }
        set((state) => ({ templates: [...state.templates, template] }));
        return template;
      },

      updateTemplate: async (id, updates) => {
        const existing = get().templates.find((t) => t.id === id);
        if (existing === undefined) return false;
        const merged: TaskTemplate = { ...existing, ...updates };
        if (!(await writeThrough(() => upsertTemplate(merged)))) {
          syncFail('同步失败，习惯未更新');
          return false;
        }
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? merged : t)),
        }));
        return true;
      },

      deleteTemplate: async (id) => {
        if (!(await writeThrough(() => removeTemplate(id)))) {
          syncFail('同步失败，习惯未删除');
          return false;
        }
        set((state) => {
          const completions: CompletionMap = {};
          for (const key of Object.keys(state.completions)) {
            const ids = state.completions[key].filter((x) => x !== id);
            if (ids.length > 0) completions[key] = ids;
            // 同步清理云端打卡记录里的残留 id
            void upsertCompletion(key, ids);
          }
          return { templates: state.templates.filter((t) => t.id !== id), completions };
        });
        return true;
      },

      archiveTemplate: async (id) => {
        const existing = get().templates.find((t) => t.id === id);
        if (existing === undefined) return false;
        const merged: TaskTemplate = { ...existing, archived: true };
        if (!(await writeThrough(() => upsertTemplate(merged)))) {
          syncFail('同步失败，习惯未归档');
          return false;
        }
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? merged : t)),
        }));
        return true;
      },

      unarchiveTemplate: async (id) => {
        const existing = get().templates.find((t) => t.id === id);
        if (existing === undefined) return false;
        const merged: TaskTemplate = { ...existing, archived: false };
        if (!(await writeThrough(() => upsertTemplate(merged)))) {
          syncFail('同步失败，习惯未恢复');
          return false;
        }
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? merged : t)),
        }));
        return true;
      },

      toggleCompletion: async (templateId, date) => {
        const day = get().completions[date] ?? [];
        const has = day.includes(templateId);
        const next = has ? day.filter((x) => x !== templateId) : [...day, templateId];
        if (!(await writeThrough(() => upsertCompletion(date, next)))) {
          syncFail('同步失败，打卡未保存');
          return false;
        }
        set((state) => ({ completions: { ...state.completions, [date]: next } }));
        return true;
      },

      setCompleted: async (templateId, date, done) => {
        const day = get().completions[date] ?? [];
        const has = day.includes(templateId);
        if (has === done) return true;
        const next = done ? [...day, templateId] : day.filter((x) => x !== templateId);
        if (!(await writeThrough(() => upsertCompletion(date, next)))) {
          syncFail('同步失败，打卡未保存');
          return false;
        }
        set((state) => ({ completions: { ...state.completions, [date]: next } }));
        return true;
      },

      updateReminderSettings: (updates) =>
        // 本地立即生效；云端弱一致推送由 App 层统一监听后执行
        set((state) => ({ reminderSettings: { ...state.reminderSettings, ...updates } })),

      recordReminderSent: (timestamp) =>
        set((state) => ({ reminderSettings: { ...state.reminderSettings, lastSentAt: timestamp } })),
    }),
    { name: 'daily-habit-storage', version: 1, migrate: (persistedState, _version) => {
      // 与任务 store 对齐：建立版本迁移机制，为后续字段变更提供兜底路径。
      // 当前为 v1，仅做结构兜底（templates 必须是数组、completions 必须是对象）。
      if (persistedState === null || typeof persistedState !== 'object') return persistedState;
      const obj = persistedState as Record<string, unknown>;
      const inner = obj.state && typeof obj.state === 'object' ? (obj.state as Record<string, unknown>) : obj;
      if (!Array.isArray(inner.templates)) inner.templates = [];
      if (inner.completions === null || typeof inner.completions !== 'object' || Array.isArray(inner.completions)) {
        inner.completions = {};
      }
      return persistedState as HabitStoreState;
    } },
  ),
);
