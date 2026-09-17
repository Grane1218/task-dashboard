// 静默时段共享工具：任务提醒与习惯提醒共用同一套判定，避免双份实现
export interface QuietHoursSettings {
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function isInQuietHours(settings: QuietHoursSettings, now: Date = new Date()): boolean {
  if (!settings.quietEnabled) return false;
  const start = toMinutes(settings.quietStart);
  const end = toMinutes(settings.quietEnd);
  const current = now.getHours() * 60 + now.getMinutes();

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  // 跨天静默时段，例如 22:00 - 08:00
  return current >= start || current < end;
}
