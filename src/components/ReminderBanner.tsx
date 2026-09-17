import { BellRing, X } from 'lucide-react';
import { NOTIFICATION_TITLE } from '../utils/notificationHelper';

interface ReminderBannerProps {
  title?: string;
  message: string;
  onDismiss: () => void;
}

export default function ReminderBanner({ title = NOTIFICATION_TITLE, message, onDismiss }: ReminderBannerProps) {
  return (
    <div className="animate-toast-in pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border/50 bg-card/85 p-4 shadow-apple-lg backdrop-blur-xl">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BellRing className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关闭提醒"
        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
