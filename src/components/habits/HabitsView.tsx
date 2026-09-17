import { useMemo, useState } from 'react';
import { Archive, Inbox, RotateCcw, Trash2 } from 'lucide-react';
import type { TaskTemplate } from '../../types/habit';
import { useHabitStore } from '../../store/useHabitStore';
import { calcStreak, formatDateKey, getDayStats, todayKey } from '../../utils/habit';
import ProgressCard from './ProgressCard';
import HabitItem from './HabitItem';

interface HabitsViewProps {
  onEdit: (habit: TaskTemplate) => void;
  onDelete: (habit: TaskTemplate) => void;
}

export default function HabitsView({ onEdit, onDelete }: HabitsViewProps) {
  const templates = useHabitStore((state) => state.templates);
  const completions = useHabitStore((state) => state.completions);
  const toggleCompletion = useHabitStore((state) => state.toggleCompletion);
  const archiveTemplate = useHabitStore((state) => state.archiveTemplate);
  const unarchiveTemplate = useHabitStore((state) => state.unarchiveTemplate);

  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const isBackfill = selectedDate !== today;

  const handleArchive = (habit: TaskTemplate) => {
    archiveTemplate(habit.id);
  };

  const active = useMemo(() => templates.filter((t) => !t.archived), [templates]);
  const archived = useMemo(() => templates.filter((t) => t.archived), [templates]);

  const done = completions[selectedDate] ?? [];
  const stats = useMemo(
    () => getDayStats(selectedDate, active, completions),
    [selectedDate, active, completions],
  );
  const streak = useMemo(() => calcStreak(active, completions), [active, completions]);

  if (templates.length === 0) {
    return (
      <section className="surface p-10 text-center">
        <Inbox className="mx-auto h-10 w-10 opacity-40" />
        <p className="mt-3 text-sm text-muted-foreground">还没有每日习惯。</p>
        <p className="mt-1 text-sm text-muted-foreground">点击右上角「添加习惯」，创建后每天在此勾选完成。</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressCard
        total={stats.total}
        completed={stats.completed}
        streak={streak}
        title={isBackfill ? formatDateKey(selectedDate) + ' 进度' : '今日进度'}
      />

      {/* 日期选择：默认今天，可选历史日期补记 */}
      <div className="surface flex flex-wrap items-center gap-3 px-4 py-3">
        <label htmlFor="habit-date" className="text-sm font-medium text-foreground">
          查看日期
        </label>
        <input
          id="habit-date"
          type="date"
          value={selectedDate}
          max={today}
          onChange={(event) => {
            if (event.target.value !== '') setSelectedDate(event.target.value);
          }}
          className="input-apple w-auto"
        />
        {isBackfill && (
          <>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">正在补记 {formatDateKey(selectedDate)} 的习惯</span>
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              回到今天
            </button>
          </>
        )}
      </div>

      {/* 当日习惯列表（选中日期） */}
      <div className="space-y-2.5">
        {active.map((habit) => (
          <HabitItem
            key={habit.id}
            habit={habit}
            done={done.includes(habit.id)}
            onToggle={(id) => toggleCompletion(id, selectedDate)}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={handleArchive}
          />
        ))}
        {active.length === 0 && (
          <section className="surface p-8 text-center text-sm text-muted-foreground">
            没有进行中的习惯，可在下方「已归档」中恢复。
          </section>
        )}
      </div>

      {/* 已归档：恢复或永久删除（完成记录保留，删除会一并清除记录） */}
      {archived.length > 0 && (
        <section className="surface p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Archive className="h-4 w-4" />
            已归档（{archived.length}）
          </h3>
          <div className="mt-2 space-y-2">
            {archived.map((habit) => (
              <div key={habit.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                {habit.emoji !== undefined && habit.emoji !== '' && (
                  <span className="text-lg leading-none opacity-60">{habit.emoji}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">{habit.title}</span>
                <button
                  type="button"
                  onClick={() => unarchiveTemplate(habit.id)}
                  aria-label="恢复习惯"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  恢复
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(habit)}
                  aria-label="永久删除习惯"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
