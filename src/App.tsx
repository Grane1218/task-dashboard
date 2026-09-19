import { useEffect, useState } from 'react';
import type { Task, View } from './types';
import type { TaskTemplate } from './types/habit';
import { useTaskStore } from './store/useTaskStore';
import { useHabitStore } from './store/useHabitStore';
import { useToastStore } from './store/useToastStore';
import { useReminders } from './hooks/useReminders';
import { DEFAULT_FILTERS, type TaskFilters } from './utils/filter';
import { buildHabitReminderBody, HABIT_NOTIFICATION_TITLE, todayKey } from './utils/habit';
import Header from './components/Header';
import PermissionBanner from './components/PermissionBanner';
import StatsCards from './components/StatsCards';
import FilterBar from './components/FilterBar';
import BoardView from './components/BoardView';
import TaskModal from './components/TaskModal';
import ConfirmDialog from './components/ConfirmDialog';
import ReminderSettingsModal from './components/ReminderSettingsModal';
import HabitsView from './components/habits/HabitsView';
import StatsView from './components/StatsView';
import CalendarView from './components/CalendarView';
import HabitModal from './components/habits/HabitModal';
import HabitReminderSettingsModal from './components/habits/HabitReminderSettingsModal';
import FocusModal from './components/FocusModal';
import KeyboardHelpModal from './components/KeyboardHelpModal';
import ReminderBanner from './components/ReminderBanner';
import Toaster from './components/Toaster';
import StartupSummaryModal from './components/StartupSummaryModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { isOverdue } from './utils/date';
import { buildNotificationBody, NOTIFICATION_TITLE, showSystemNotification } from './utils/notificationHelper';
import {
  getCloudStatus,
  hydrateFromCloud,
  isCloudConfigured,
  onCloudStatusChange,
  pushSettings,
  uploadLocalToCloud,
  type CloudStatus,
} from './lib/cloud';
import {
  dismissStartupForToday,
  isInAnyQuietHours,
  readStartupState,
  writeStartupState,
} from './utils/startupState';

export default function App() {
  const tasks = useTaskStore((state) => state.tasks);
  const theme = useTaskStore((state) => state.theme);
  const setTheme = useTaskStore((state) => state.setTheme);
  const reminderSettings = useTaskStore((state) => state.reminderSettings);
  const habitReminder = useHabitStore((state) => state.reminderSettings);
  const addToast = useToastStore((state) => state.addToast);

  const reminders = useReminders();

  const [view, setView] = useState<View>('board');
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDatePrefill, setTaskDatePrefill] = useState<string | null>(null);
  const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<TaskTemplate | null>(null);
  const [habitSettingsOpen, setHabitSettingsOpen] = useState(false);
  const [deleteHabitTarget, setDeleteHabitTarget] = useState<TaskTemplate | null>(null);
  const [startupTasks, setStartupTasks] = useState<Task[]>([]);
  const [startupHabits, setStartupHabits] = useState<TaskTemplate[]>([]);
  const [showStartupModal, setShowStartupModal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // —— 云端：状态订阅 / 设置弱一致推送 / 启动引导 ——
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(getCloudStatus());

  useEffect(() => onCloudStatusChange(setCloudStatus), []);

  // 设置类变更（提醒设置/主题）尽力推云：失败静默，下次成功时整体覆盖
  useEffect(() => {
    if (!isCloudConfigured()) return;
    pushSettings({ taskReminder: reminderSettings, habitReminder, theme });
  }, [reminderSettings, habitReminder, theme]);

  // 启动引导：拉云端全量覆盖本地（云端为权威源）；云端为空且本地有数据时执行首次迁移
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snapshot = await hydrateFromCloud();
      if (cancelled || snapshot === null) return;
      const taskState = useTaskStore.getState();
      const habitState = useHabitStore.getState();

      useTaskStore.setState({
        tasks: snapshot.tasks,
        ...(snapshot.settings?.taskReminder ? { reminderSettings: snapshot.settings.taskReminder } : {}),
        ...(snapshot.settings?.theme ? { theme: snapshot.settings.theme } : {}),
      });
      useHabitStore.setState({
        templates: snapshot.templates,
        completions: snapshot.completions,
        ...(snapshot.settings?.habitReminder ? { reminderSettings: snapshot.settings.habitReminder } : {}),
      });

      // 首次迁移：云端没有任何任务，但本地已有数据 → 全量上传一次（幂等，可重跑）
      if (snapshot.tasks.length === 0) {
        const hadLocalData = taskState.tasks.length > 0 || habitState.templates.length > 0;
        if (hadLocalData) {
          const result = await uploadLocalToCloud({
            tasks: taskState.tasks,
            templates: habitState.templates,
            completions: habitState.completions,
            settings: {
              taskReminder: taskState.reminderSettings,
              habitReminder: habitState.reminderSettings,
              theme: taskState.theme,
            },
          });
          if (result.ok) addToast('已同步到云端（首次迁移完成）');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  // 每次运行（页面加载）时：检查未完成的任务与习惯，弹出清单并（已授权且非静默时段时）发送系统通知。
  // 弹窗与通知均为「每天一次」：弹窗可点「今天不再提醒」关闭当天，通知当天只发一次。
  useEffect(() => {
    const tasksState = useTaskStore.getState();
    const habitState = useHabitStore.getState();
    const pendingTasks = tasksState.tasks.filter((t) => t.status !== 'done' && !t.archived);
    const today = todayKey();
    const doneIds = habitState.completions[today] ?? [];
    const pendingHabits = habitState.templates.filter((t) => !t.archived && !doneIds.includes(t.id));

    setStartupTasks(pendingTasks);
    setStartupHabits(pendingHabits);

    const state = readStartupState();
    const current =
      state.date !== today ? { date: today, dismissed: false, notified: false } : state;

    if (pendingTasks.length > 0 || pendingHabits.length > 0) {
      if (!current.dismissed) setShowStartupModal(true);
      if (!current.notified && !isInAnyQuietHours(tasksState.reminderSettings, habitState.reminderSettings)) {
        current.notified = true;
        if (pendingTasks.length > 0) showSystemNotification(NOTIFICATION_TITLE, buildNotificationBody(pendingTasks));
        if (pendingHabits.length > 0) showSystemNotification(HABIT_NOTIFICATION_TITLE, buildHabitReminderBody(pendingHabits));
      }
    }
    writeStartupState(current);
  }, []);

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskDatePrefill(null);
    setTaskModalOpen(true);
  };

  const openCreateTaskOn = (dateKey: string) => {
    setEditingTask(null);
    setTaskDatePrefill(dateKey);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const openFocus = (task: Task) => {
    setFocusTask(task);
  };

  const confirmDeleteTask = () => {
    const target = deleteTaskTarget;
    setDeleteTaskTarget(null);
    if (target === null) return;
    // 延迟 5 秒真正删除，期间可在 Toast 中撤销
    const timer = window.setTimeout(() => {
      useTaskStore.getState().deleteTask(target.id);
    }, 5000);
    addToast('任务已删除，5 秒内可撤销', 'success', {
      actionLabel: '撤销',
      duration: 6000,
      onAction: () => window.clearTimeout(timer),
    });
  };

  const openCreateHabit = () => {
    setEditingHabit(null);
    setHabitModalOpen(true);
  };

  const openEditHabit = (habit: TaskTemplate) => {
    setEditingHabit(habit);
    setHabitModalOpen(true);
  };

  const confirmDeleteHabit = () => {
    const target = deleteHabitTarget;
    setDeleteHabitTarget(null);
    if (target === null) return;
    // 延迟 5 秒真正删除，期间可在 Toast 中撤销（完成记录随删除一并清除）
    const timer = window.setTimeout(() => {
      useHabitStore.getState().deleteTemplate(target.id);
    }, 5000);
    addToast('习惯已删除，5 秒内可撤销', 'success', {
      actionLabel: '撤销',
      duration: 6000,
      onAction: () => window.clearTimeout(timer),
    });
  };

  const handleDismissStartupToday = () => {
    dismissStartupForToday(todayKey());
    setShowStartupModal(false);
  };

  const handleOpenSettings = () => {
    if (view === 'board') setTaskSettingsOpen(true);
    else setHabitSettingsOpen(true);
  };

  const handleCreate = () => {
    if (view === 'board' || view === 'calendar') openCreateTask();
    else openCreateHabit();
  };

  // 番茄钟完成时标记任务完成（与卡片完成逻辑一致：重复任务生成下一周期副本）
  const handleMarkDoneFromFocus = async (task: Task) => {
    const wasOverdue = isOverdue(task.startDate, task.dueDate, task.status);
    if (task.repeat !== undefined) {
      const next = await useTaskStore.getState().completeRecurring(task.id);
      if (next === undefined) return; // 云写失败，保持弹窗可重试
      addToast(next !== null ? '任务已完成，已生成下一周期任务' : '任务已完成');
    } else {
      const ok = await useTaskStore.getState().toggleDone(task.id);
      if (!ok) return; // 云写失败，保持弹窗可重试
      addToast(wasOverdue ? '任务已完成（已逾期）' : '任务已完成');
    }
    setFocusTask(null);
  };

  // 键盘快捷键：N 新建 / / 搜索 / 1-4 切视图 / D 切主题 / ? 帮助
  useKeyboardShortcuts({
    onNew: handleCreate,
    onSearch: () => {
      setView('board');
      window.requestAnimationFrame(() => {
        const input = document.getElementById('task-search');
        if (input !== null) (input as HTMLInputElement).focus();
      });
    },
    onSwitchView: setView,
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onHelp: () => setShowKeyboardHelp(true),
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header view={view} onSwitchView={setView} onOpenSettings={handleOpenSettings} onCreate={handleCreate} />
      <PermissionBanner />

      {cloudStatus === 'failed' && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <span>云端未连接，当前为本地模式（数据仅保存在本机）。请在项目根目录 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">.env</code> 中配置 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">VITE_CLOUDBASE_ENV</code> 并开通云开发。</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {view === 'board' ? (
          <>
            <StatsCards tasks={tasks} />
            <FilterBar filters={filters} onChange={setFilters} />
            <BoardView
              tasks={tasks}
              filters={filters}
              onEdit={openEditTask}
              onDelete={setDeleteTaskTarget}
              onFocus={openFocus}
              onClearFilters={() => setFilters(DEFAULT_FILTERS)}
            />
          </>
        ) : view === 'habits' ? (
          <HabitsView onEdit={openEditHabit} onDelete={setDeleteHabitTarget} />
        ) : view === 'calendar' ? (
          <CalendarView tasks={tasks} onEdit={openEditTask} onCreateForDate={openCreateTaskOn} />
        ) : (
          <StatsView />
        )}
      </main>

      {/* 任务相关弹窗 */}
      <TaskModal open={taskModalOpen} task={editingTask} initialStartDate={taskDatePrefill} onClose={() => setTaskModalOpen(false)} />
      <FocusModal open={focusTask !== null} task={focusTask} onClose={() => setFocusTask(null)} onMarkDone={handleMarkDoneFromFocus} />
      <KeyboardHelpModal open={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
      <ConfirmDialog
        open={deleteTaskTarget !== null}
        title="删除任务"
        description={'确定要删除任务「' + (deleteTaskTarget !== null ? deleteTaskTarget.title : '') + '」吗？删除后 5 秒内可在提示中撤销。'}
        onConfirm={confirmDeleteTask}
        onCancel={() => setDeleteTaskTarget(null)}
      />
      <ReminderSettingsModal open={taskSettingsOpen} onClose={() => setTaskSettingsOpen(false)} />

      {/* 习惯相关弹窗 */}
      <HabitModal open={habitModalOpen} habit={editingHabit} onClose={() => setHabitModalOpen(false)} />
      <ConfirmDialog
        open={deleteHabitTarget !== null}
        title="删除习惯"
        description={'确定要删除习惯「' + (deleteHabitTarget !== null ? deleteHabitTarget.title : '') + '」吗？完成记录将一并清除，删除后 5 秒内可在提示中撤销。'}
        onConfirm={confirmDeleteHabit}
        onCancel={() => setDeleteHabitTarget(null)}
      />
      <HabitReminderSettingsModal open={habitSettingsOpen} onClose={() => setHabitSettingsOpen(false)} />

      {/* 启动时未完成清单弹窗 */}
      <StartupSummaryModal
        open={showStartupModal}
        pendingTasks={startupTasks}
        pendingHabits={startupHabits}
        onClose={() => setShowStartupModal(false)}
        onDismissToday={handleDismissStartupToday}
      />

      {/* 内部提醒横幅（右下角堆叠） */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2">
        {reminders.taskBanner !== null && (
          <ReminderBanner message={reminders.taskBanner.message} onDismiss={reminders.dismissTaskBanner} />
        )}
        {reminders.habitBanner !== null && (
          <ReminderBanner title={reminders.habitBanner.title} message={reminders.habitBanner.message} onDismiss={reminders.dismissHabitBanner} />
        )}
      </div>

      <Toaster />
    </div>
  );
}