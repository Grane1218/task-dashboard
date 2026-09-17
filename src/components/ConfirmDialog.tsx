import { AlertTriangle, X } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, description, confirmLabel = '删除', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} title={title} panelClassName="max-w-sm rounded-3xl bg-popover p-6 shadow-apple-lg">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="关闭" className="btn-ghost">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          取消
        </button>
        <button type="button" onClick={onConfirm} className="btn-danger">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
