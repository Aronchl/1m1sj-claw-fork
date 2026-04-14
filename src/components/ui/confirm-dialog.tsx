/**
 * ConfirmDialog - In-DOM confirmation dialog (replaces window.confirm)
 * Keeps focus within the renderer to avoid Windows focus loss after native dialogs.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onError?: (error: unknown) => void;
  /** Optional hook for E2E / automation */
  testId?: string;
  /** Shown on the confirm button while `onConfirm` promise is pending */
  pendingConfirmLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  onError,
  testId,
  pendingConfirmLabel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset confirming when dialog closes (during render to avoid setState-in-effect)
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setConfirming(false);
    }
  }

  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !confirming) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (confirming) return;
    const result = onConfirm();
    if (result instanceof Promise) {
      setConfirming(true);
      result.catch((error) => {
        if (onError) {
          onError(error);
        }
      }).finally(() => {
        setConfirming(false);
      });
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[120] flex items-center justify-center bg-black/50',
        confirming && 'cursor-wait',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-busy={confirming}
      data-testid={testId}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          'mx-4 max-w-md rounded-lg border bg-card p-6 shadow-lg',
          'focus:outline-none',
          confirming && 'pointer-events-none',
        )}
        tabIndex={-1}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className={cn('mt-6 flex justify-end gap-2', confirming && 'pointer-events-auto')}>
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={confirming}
            className={cn('min-w-[7rem]', confirming && 'disabled:opacity-100')}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                <span>{pendingConfirmLabel ?? confirmLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
