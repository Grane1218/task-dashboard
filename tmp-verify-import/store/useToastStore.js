"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useToastStore = void 0;
const zustand_1 = require("zustand");
function createToastId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}
exports.useToastStore = (0, zustand_1.create)((set) => ({
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
    removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
