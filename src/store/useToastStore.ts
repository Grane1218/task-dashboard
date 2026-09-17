import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** 自动消失时长（毫秒），默认 3000 */
  duration?: number;
}

interface ToastStoreState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

function createToastId(): string {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  addToast: (message, type = 'success', options) => {
    const id = createToastId();
    const duration = options?.duration ?? 3000;
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id,
          message,
          type,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
        },
      ],
    }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
