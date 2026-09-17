import { CalendarClock, CheckCircle2, Clock, ListTodo, Loader } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Task } from '../types';
import { isDueToday } from '../utils/date';

interface StatsCardsProps {
  tasks: Task[];
}

interface StatCard {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  urgent?: boolean;
}

export default function StatsCards({ tasks }: StatsCardsProps) {
  const activeTasks = tasks.filter((task) => !task.archived);
  const total = activeTasks.length;
  const todo = activeTasks.filter((task) => task.status === 'todo').length;
  const inProgress = activeTasks.filter((task) => task.status === 'in-progress').length;
  const done = activeTasks.filter((task) => task.status === 'done').length;
  const dueToday = activeTasks.filter((task) => task.status !== 'done' && isDueToday(task.dueDate)).length;

  const cards: StatCard[] = [
    { label: '总任务', value: total, icon: ListTodo, iconClass: 'bg-primary/10 text-primary' },
    { label: '待处理', value: todo, icon: Clock, iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { label: '进行中', value: inProgress, icon: Loader, iconClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: '已完成', value: done, icon: CheckCircle2, iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: '今日截止', value: dueToday, icon: CalendarClock, iconClass: 'bg-red-500/10 text-red-600 dark:text-red-400', urgent: true },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-apple transition-shadow duration-200 hover:shadow-apple-md">
            <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + card.iconClass}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className={'text-2xl font-bold leading-tight tracking-tight tabular-nums ' + (card.urgent ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                {card.value}
              </div>
              <div className="truncate text-[13px] text-muted-foreground">{card.label}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}