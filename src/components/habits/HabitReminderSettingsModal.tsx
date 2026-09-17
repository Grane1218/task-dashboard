import { useEffect, useState } from 'react';
import { Bell, Moon, X } from 'lucide-react';
import type { HabitReminderSettings } from '../../types/habit';
import { useHabitStore } from '../../store/useHabitStore';
import { useToastStore } from '../../store/useToastStore';
import Modal from '../Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HabitReminderSettingsModal({ open, onClose }: Props) {
  const settings = useHabitStore((state) => state.reminderSettings);
  const updateReminderSettings = useHabitStore((state) => state.updateReminderSettings);
  const addToast = useToastStore((state) => state.addToast);

  const [draft, setDraft] = useState<HabitReminderSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const updateDraft = <K extends keyof HabitReminderSettings>(key: K, value: HabitReminderSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateReminderSettings(draft);
    addToast('提醒设置已保存');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="每日习惯提醒" panelClassName="max-w-md rounded-3xl bg-popover p-6 shadow-apple-lg">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-bold tracking-tight">每日习惯提醒</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭" className="btn-ghost">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">启用提醒</p>
            <p className="mt-0.5 text-xs text-muted-foreground">每天到点提醒未完成的习惯</p>
          </div>
          <Toggle checked={draft.enabled} onChange={(value) => updateDraft('enabled', value)} />
        </div>

        <fieldset disabled={!draft.enabled} className={'space-y-5 ' + (draft.enabled ? '' : 'opacity-50')}>
          <div>
            <label htmlFor="habit-reminder-time" className="mb-1.5 block text-sm font-medium text-foreground">
              提醒时间
            </label>
            <input
              id="habit-reminder-time"
              type="time"
              value={draft.time}
              onChange={(event) => updateDraft('time', event.target.value)}
              className="input-apple"
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">静默时段</span>
              </div>
              <Toggle checked={draft.quietEnabled} onChange={(value) => updateDraft('quietEnabled', value)} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">在此时段内不发送提醒，避免打扰</p>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="time"
                value={draft.quietStart}
                onChange={(event) => updateDraft('quietStart', event.target.value)}
                className="input-apple flex-1"
              />
              <span className="text-sm text-muted-foreground">至</span>
              <input
                type="time"
                value={draft.quietEnd}
                onChange={(event) => updateDraft('quietEnd', event.target.value)}
                className="input-apple flex-1"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button type="button" onClick={handleSave} className="btn-primary">
            保存设置
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** iOS 风格开关：开启时为绿色 */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ' +
        (checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')
      }
    >
      <span
        className={
          'absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ' +
          (checked ? 'translate-x-5' : 'translate-x-0')
        }
      />
    </button>
  );
}
