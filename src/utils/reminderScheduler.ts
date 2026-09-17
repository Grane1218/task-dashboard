import type { ReminderSettings, Task } from '../types';
import { isInQuietHours } from './quietHours';

export { isInQuietHours };

export type ReminderBlockReason =
  | 'disabled'
  | 'no-tasks'
  | 'not-time'
  | 'quiet-hours'
  | 'already-sent';

export interface ReminderCheckResult {
  shouldNotify: boolean;
  pendingTasks: Task[];
  reason: ReminderBlockReason | null;
}

export function shouldTriggerReminder(
  settings: ReminderSettings,
  pendingTasks: Task[],
  now: Date = new Date(),
): ReminderCheckResult {
  const blocked = (reason: ReminderBlockReason): ReminderCheckResult => ({
    shouldNotify: false,
    pendingTasks,
    reason,
  });

  if (!settings.enabled) return blocked('disabled');
  if (pendingTasks.length === 0) return blocked('no-tasks');
  if (isInQuietHours(settings, now)) return blocked('quiet-hours');
  if (!hasReachedTime(settings, now)) return blocked('not-time');
  if (hasSentInCurrentCycle(settings, now)) return blocked('already-sent');

  return { shouldNotify: true, pendingTasks, reason: null };
}

export function hasReachedTime(settings: ReminderSettings, now: Date): boolean {
  const [hours, minutes] = settings.time.split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= (hours ?? 0) * 60 + (minutes ?? 0);
}

export function hasSentInCurrentCycle(settings: ReminderSettings, now: Date): boolean {
  if (settings.lastSentAt === null) return false;
  const last = new Date(settings.lastSentAt);
  switch (settings.frequency) {
    case 'daily':
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
      );
    case 'weekly':
      return mondayOf(last).getTime() === mondayOf(now).getTime();
    case 'monthly':
      return last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth();
  }
}

// 自然周期锚点：每周以周一为一周起点，跨周期不会漂移
function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 周日=6，周一=0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}