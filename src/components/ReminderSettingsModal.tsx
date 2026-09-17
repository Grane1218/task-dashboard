import { useEffect, useState } from 'react';
import { Bell, Moon, X } from 'lucide-react';
import type { ReminderFrequency, ReminderSettings } from '../types';
import { FREQUENCY_LABELS } from '../types';
import { useTaskStore } from '../store/useTaskStore';
import { useToastStore } from '../store/useToastStore';
import Modal from './Modal';

interface ReminderSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const FREQUENCIES: ReminderFrequency[] = ['daily', 'weekly', 'monthly'];

export default function ReminderSettingsModal({ open, onClose }: ReminderSettingsModalProps) {
  const settings = useTaskStore((state) => state.reminderSettings);
  const updateReminderSettings = useTaskStore((state) => state.updateReminderSettings);
  const addToast = useToastStore((state) => state.addToast);

  const [draft, setDraft] = useState<ReminderSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const updateDraft = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateReminderSettings(draft);
    addToast('提醒设置已保存');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="提醒设置" panelClassName="max-w-md rounded-3xl bg-popover p-6 shadow-apple-lg">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-bold tracking-tight">提醒设置</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭" className="btn-ghost">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">启用提醒</p>
            <p className="mt-0.5 text-xs text-muted-foreground">开启后每分钟检查未完成任务</p>
          </div>
          <Toggle checked={draft.enabled} onChange={(value) => updateDraft('enabled', value)} />
        </div>

        <fieldset disabled={!draft.enabled} className={'space-y-5 ' + (draft.enabled ? '' : 'opacity-50')}>
          <div>
            <label htmlFor="reminder-frequency" className="mb-1.5 block text-sm font-medium text-foreground">
              提醒频率
            </label>
            <select
              id="reminder-frequency"
              value={draft.frequency}
              onChange={(event) => updateDraft('frequency', event.target.value as ReminderFrequency)}
              className="input-apple"
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reminder-time" className="mb-1.5 block text-sm font-medium text-foreground">
              首次提醒时间
            </label>
            <input
              id="reminder-time"
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
