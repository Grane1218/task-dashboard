import { Keyboard } from 'lucide-react';
import Modal from './Modal';

interface KeyboardHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: 'N', desc: '新建任务 / 习惯（跟随当前页签）' },
  { keys: '/', desc: '聚焦搜索框（自动切到任务看板）' },
  { keys: '1', desc: '任务看板' },
  { keys: '2', desc: '每日习惯' },
  { keys: '3', desc: '日历' },
  { keys: '4', desc: '统计' },
  { keys: 'D', desc: '切换深色 / 浅色模式' },
  { keys: 'Esc', desc: '关闭弹窗' },
];

export default function KeyboardHelpModal({ open, onClose }: KeyboardHelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="键盘快捷键" panelClassName="rounded-3xl bg-popover p-6 shadow-apple-lg">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Keyboard className="h-5 w-5" />
          </span>
          键盘快捷键
        </h2>
      </div>
      <div className="space-y-1.5">
        {SHORTCUTS.map((item) => (
          <div key={item.keys} className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3.5 py-2.5">
            <span className="text-sm text-foreground">{item.desc}</span>
            <kbd className="rounded-lg border border-border/70 bg-card px-2 py-1 font-mono text-xs font-semibold text-primary shadow-sm">
              {item.keys}
            </kbd>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">输入框聚焦时快捷键不生效，避免干扰打字。</p>
    </Modal>
  );
}
