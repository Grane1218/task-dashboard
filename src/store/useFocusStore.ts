import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const FOCUS_DURATION_MIN = 25;
export const FOCUS_SHORT_BREAK_MIN = 5;

interface FocusStoreState {
  /** 正在专注的任务 id（null=没有进行中的专注） */
  taskId: string | null;
  taskTitle: string;
  durationMin: number;
  /** 运行中的结束时间戳；null 表示未开始/已结束 */
  deadline: number | null;
  /** 暂停时冻结的剩余毫秒；null 表示运行中/未开始 */
  pausedAt: number | null;
  start: (taskId: string, taskTitle: string, minutes?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export const useFocusStore = create<FocusStoreState>()(
  persist(
    (set, get) => ({
      taskId: null,
      taskTitle: '',
      durationMin: FOCUS_DURATION_MIN,
      deadline: null,
      pausedAt: null,

      start: (taskId, taskTitle, minutes = FOCUS_DURATION_MIN) =>
        set({
          taskId,
          taskTitle,
          durationMin: minutes,
          deadline: Date.now() + minutes * 60 * 1000,
          pausedAt: null,
        }),

      // 暂停：把剩余毫秒冻结到 pausedAt，倒计时不再随时间流逝
      pause: () => {
        const { deadline } = get();
        if (deadline === null) return;
        set({ pausedAt: Math.max(0, deadline - Date.now()) });
      },

      // 继续：按冻结的剩余毫秒重新计算结束时间戳
      resume: () => {
        const { pausedAt } = get();
        if (pausedAt === null) return;
        set({ deadline: Date.now() + pausedAt, pausedAt: null });
      },

      stop: () => set({ taskId: null, taskTitle: '', deadline: null, pausedAt: null }),
    }),
    { name: 'task-dashboard-focus', version: 1 },
  ),
);

/** 剩余毫秒；未开始时返回 0，暂停时返回冻结值 */
export function getFocusRemainingMs(state: FocusStoreState, now: number = Date.now()): number {
  if (state.deadline === null) return 0;
  if (state.pausedAt !== null) return state.pausedAt;
  return Math.max(0, state.deadline - now);
}
