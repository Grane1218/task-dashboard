import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Repeat } from 'lucide-react';
import type { Priority, Task } from '../types';
import { PRIORITY_LABELS } from '../types';
import { parseDueDate } from '../utils/date';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

interface CalendarViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onCreateForDate: (dateKey: string) => void;
}

const MAX_TASKS_PER_CELL = 3;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export default function CalendarView({ tasks, onEdit, onCreateForDate }: CalendarViewProps) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const cells = useMemo(() => {
    const firstDay = new Date(cursor.year, cursor.month, 1);
    const offset = (firstDay.getDay() + 6) % 7; // 周一起点
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: Array<Date | null> = [
      ...Array<null>(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.year, cursor.month, i + 1)),
    ];
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const byDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (task.archived) continue;
      const due = parseDueDate(task.dueDate);
      const start = parseDueDate(task.startDate);
      const target = due ?? start; // 有截止日期显示在截止日，否则显示在开始日
      if (target === null) continue;
      const key = toDateKey(target);
      if (map[key] === undefined) map[key] = [];
      map[key].push(task);
    }
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    for (const key of Object.keys(map)) {
      map[key].sort(
        (a, b) =>
          (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
          rank[a.priority] - rank[b.priority],
      );
    }
    return map;
  }, [tasks]);

  const todayKey = toDateKey(now);

  const moveMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const hasTasks = Object.keys(byDate).length > 0;

  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">
          {cursor.year} 年 {cursor.month + 1} 月
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="上个月" className="btn-ghost">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            今天
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="下个月" className="btn-ghost">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!hasTasks && tasks.filter((t) => !t.archived).length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-1 py-6 text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-40" />
          <p className="text-sm">还没有任务，点击空白日期可快速创建（自动带上当天日期）。</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 text-center text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted/60 py-2 font-medium text-muted-foreground">
            周{label}
          </div>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return <div key={'empty-' + index} className="min-h-16 bg-card" />;
          }
          const key = toDateKey(day);
          const dayTasks = byDate[key] ?? [];
          const isToday = key === todayKey;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={key}
              className={
                'group flex min-h-16 cursor-pointer flex-col gap-0.5 bg-card p-1.5 transition-colors hover:bg-accent/40' +
                (isWeekend ? ' bg-muted/20' : '')
              }
              onClick={() => onCreateForDate(key)}
              title="点击新建当天任务"
            >
              <span
                className={
                  'flex h-6 w-6 items-center justify-center self-start rounded-full text-[11px] leading-none transition-colors ' +
                  (isToday
                    ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                    : dayTasks.length > 0
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground')
                }
              >
                {day.getDate()}
              </span>

              {dayTasks.slice(0, MAX_TASKS_PER_CELL).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(task);
                  }}
                  title={
                    task.title +
                    (task.dueDate !== '' ? ' · 截止 ' + task.dueDate.replace('T', ' ') : '') +
                    (task.repeat !== undefined ? ' · 重复' : '')
                  }
                  className={
                    'flex items-center gap-1 truncate rounded-md px-1 py-0.5 text-left text-[11px] leading-4 transition-colors hover:bg-accent ' +
                    (task.status === 'done'
                      ? 'text-muted-foreground line-through opacity-60'
                      : 'text-foreground')
                  }
                >
                  <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + PRIORITY_DOT[task.priority]} />
                  <span className="truncate">{task.title}</span>
                  {task.repeat !== undefined && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                  {task.status === 'done' ? <span className="opacity-70">{PRIORITY_LABELS[task.priority]}</span> : null}
                </button>
              ))}
              {dayTasks.length > MAX_TASKS_PER_CELL && (
                <span className="px-1 text-[11px] font-medium text-muted-foreground">+{dayTasks.length - MAX_TASKS_PER_CELL}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> 高
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 中
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> 低
        </span>
        <span className="ml-auto">点击空白日期新建任务（预填当天）；点击任务可编辑</span>
      </div>
    </section>
  );
}
