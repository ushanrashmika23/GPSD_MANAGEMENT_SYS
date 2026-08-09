import { Modal } from "./Modal";
import { Btn } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-foreground">{message}</div>
        <div className="flex justify-end gap-2">
          <Btn v="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Btn>
          <Btn v={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
