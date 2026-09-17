import type { Task } from '../types';

export const NOTIFICATION_TITLE = '📋 你有未完成的任务待处理！';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';

  const current = Notification.permission;
  if (current === 'granted' || current === 'denied') {
    return current;
  }

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    // 某些受限环境/权限策略会让 requestPermission 抛错或静默失败
    return 'default';
  }
}

export function buildNotificationBody(pendingTasks: Task[]): string {
  const count = pendingTasks.length;
  const preview = pendingTasks
    .slice(0, 3)
    .map((task) => task.title)
    .join('、');
  if (count <= 3) {
    return '未完成任务共 ' + count + ' 项：' + preview;
  }
  return '未完成任务共 ' + count + ' 项：' + preview + '...等';
}

export function showSystemNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, { body, tag: 'task-reminder' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error('发送系统通知失败：', error);
  }
}