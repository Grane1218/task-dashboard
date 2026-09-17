import type { CompletionMap, HabitReminderSettings, TaskTemplate } from '../types/habit';
import { isInQuietHours, toMinutes } from './quietHours';

export { isInQuietHours };

export const HABIT_NOTIFICATION_TITLE = '📋 今日还有未完成的习惯！';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date = new Date()): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function formatDateKey(key: string): string {
  if (key === '') return '';
  const p = key.split('-');
  if (p.length !== 3) return key;
  return p[0] + '/' + p[1] + '/' + p[2];
}

export interface DayStats {
  total: number;
  completed: number;
}

export function getDayStats(date: string, templates: TaskTemplate[], completions: CompletionMap): DayStats {
  const done = completions[date] ?? [];
  const completed = templates.filter((t) => done.includes(t.id)).length;
  return { total: templates.length, completed };
}

// 连续“全部完成”的天数（含今天；若今天未全部完成，则统计到昨天为止）
export function calcStreak(templates: TaskTemplate[], completions: CompletionMap): number {
  if (templates.length === 0) return 0;
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 3660; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKey(d);
    const done = completions[key] ?? [];
    if (templates.every((t) => done.includes(t.id))) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function buildHabitReminderBody(pending: TaskTemplate[]): string {
  const count = pending.length;
  const preview = pending.slice(0, 3).map((h) => h.title).join('、');
  if (count <= 3) return '还有 ' + count + ' 项习惯未完成：' + preview;
  return '还有 ' + count + ' 项习惯未完成：' + preview + '...等';
}

export type HabitReminderBlockReason = 'disabled' | 'all-done' | 'not-time' | 'quiet-hours' | 'already-sent';

export interface HabitReminderCheckResult {
  shouldNotify: boolean;
  pending: TaskTemplate[];
  reason: HabitReminderBlockReason | null;
}

export function shouldTriggerHabitReminder(
  settings: HabitReminderSettings,
  pending: TaskTemplate[],
  now: Date = new Date(),
): HabitReminderCheckResult {
  const blocked = (reason: HabitReminderBlockReason): HabitReminderCheckResult => ({
    shouldNotify: false,
    pending,
    reason,
  });

  if (!settings.enabled) return blocked('disabled');
  if (pending.length === 0) return blocked('all-done');
  if (isInQuietHours(settings, now)) return blocked('quiet-hours');
  if (!hasReachedTime(settings, now)) return blocked('not-time');
  if (hasSentToday(settings, now)) return blocked('already-sent');

  return { shouldNotify: true, pending, reason: null };
}

export function hasReachedTime(settings: HabitReminderSettings, now: Date): boolean {
  return now.getHours() * 60 + now.getMinutes() >= toMinutes(settings.time);
}

export function hasSentToday(settings: HabitReminderSettings, now: Date): boolean {
  if (settings.lastSentAt === null) return false;
  return dateKey(new Date(settings.lastSentAt)) === dateKey(now);
}