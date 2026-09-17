import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToastStore, type ToastType } from '../store/useToastStore';

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TOAST_ICON_CLASSES: Record<ToastType, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-primary',
};

export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[60] flex w-full max-w-xs flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-border/50 bg-card/85 p-3 shadow-apple-lg backdrop-blur-xl"
          >
            <Icon className={'h-5 w-5 shrink-0 ' + TOAST_ICON_CLASSES[toast.type]} />
            <span className="flex-1 text-sm text-foreground">{toast.message}</span>
            {toast.actionLabel !== undefined && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  removeToast(toast.id);
                }}
                className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="关闭提示"
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
