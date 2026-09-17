import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompletionMap, HabitReminderSettings, TaskTemplate } from '../types/habit';

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
  addTemplate: (input: { title: string; emoji?: string; category?: string }) => TaskTemplate;
  updateTemplate: (id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  archiveTemplate: (id: string) => void;
  unarchiveTemplate: (id: string) => void;
  toggleCompletion: (templateId: string, date: string) => void;
  setCompleted: (templateId: string, date: string, done: boolean) => void;
  updateReminderSettings: (updates: Partial<HabitReminderSettings>) => void;
  recordReminderSent: (timestamp: number) => void;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export const useHabitStore = create<HabitStoreState>()(
  persist(
    (set) => ({
      templates: [],
      completions: {},
      reminderSettings: DEFAULT_HABIT_REMINDER_SETTINGS,

      addTemplate: (input) => {
        const template: TaskTemplate = {
          id: createId(),
          title: input.title,
          emoji: input.emoji?.trim() === '' ? undefined : input.emoji?.trim(),
          category: input.category?.trim() === '' ? undefined : input.category?.trim(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ templates: [...state.templates, template] }));
        return template;
      },

      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      deleteTemplate: (id) =>
        set((state) => {
          const completions: CompletionMap = {};
          for (const key of Object.keys(state.completions)) {
            const ids = state.completions[key].filter((x) => x !== id);
            if (ids.length > 0) completions[key] = ids;
          }
          return { templates: state.templates.filter((t) => t.id !== id), completions };
        }),

      archiveTemplate: (id) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, archived: true } : t)),
        })),

      unarchiveTemplate: (id) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, archived: false } : t)),
        })),

      toggleCompletion: (templateId, date) =>
        set((state) => {
          const day = state.completions[date] ?? [];
          const has = day.includes(templateId);
          const next = has ? day.filter((x) => x !== templateId) : [...day, templateId];
          return { completions: { ...state.completions, [date]: next } };
        }),

      setCompleted: (templateId, date, done) =>
        set((state) => {
          const day = state.completions[date] ?? [];
          const has = day.includes(templateId);
          if (has === done) return state;
          const next = done ? [...day, templateId] : day.filter((x) => x !== templateId);
          return { completions: { ...state.completions, [date]: next } };
        }),

      updateReminderSettings: (updates) =>
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