import type { ReminderSettings } from '../types';
import type { HabitReminderSettings } from '../types/habit';
import { isInQuietHours as isTaskQuietHours } from './reminderScheduler';
import { isInQuietHours as isHabitQuietHours } from './habit';

export interface StartupState {
  date: string; // 记录日期 "YYYY-MM-DD"
  dismissed: boolean; // 当天是否已点过「今天不再提醒」
  notified: boolean; // 当天是否已发过启动系统通知
}

const STORAGE_KEY = 'task-dashboard-startup-state';

export function readStartupState(): StartupState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { date: '', dismissed: false, notified: false };
    const parsed = JSON.parse(raw) as Partial<StartupState>;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : '',
      dismissed: parsed.dismissed === true,
      notified: parsed.notified === true,
    };
  } catch {
    return { date: '', dismissed: false, notified: false };
  }
}

export function writeStartupState(state: StartupState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可用时静默降级：本次会话内状态仍在内存中生效
  }
}

/** 标记「今天不再提醒」：保留 notified 标记，避免已发过的通知被重新触发 */
export function dismissStartupForToday(today: string): void {
  const state = readStartupState();
  writeStartupState({ date: today, dismissed: true, notified: state.notified });
}

/** 启动通知是否处于静默时段：任务或习惯任一提醒开启静默且当前在时段内则静默 */
export function isInAnyQuietHours(
  taskSettings: ReminderSettings,
  habitSettings: HabitReminderSettings,
  now: Date = new Date(),
): boolean {
  return isTaskQuietHours(taskSettings, now) || isHabitQuietHours(habitSettings, now);
}
