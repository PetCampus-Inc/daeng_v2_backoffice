import type { ComponentProps, ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/atoms/alert-dialog';

type ConfirmDialogProps = Pick<ComponentProps<typeof AlertDialogContent>, 'onOpenAutoFocus' | 'onCloseAutoFocus'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: ComponentProps<typeof AlertDialogAction>['variant'];
  onConfirm?: () => void;
  /** false이면 확인을 실행한 뒤 호출자가 열린 상태를 제어한다. */
  closeOnConfirm?: boolean;
  areButtonsDisabled?: boolean;
  status?: string;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onOpenAutoFocus,
  onCloseAutoFocus,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmVariant,
  onConfirm,
  closeOnConfirm = true,
  areButtonsDisabled = false,
  status,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className='[overflow-wrap:anywhere]'>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {status && <p role='status'>{status}</p>}
        <AlertDialogFooter>
          {cancelLabel && <AlertDialogCancel disabled={areButtonsDisabled}>{cancelLabel}</AlertDialogCancel>}
          <AlertDialogAction
            variant={confirmVariant}
            disabled={areButtonsDisabled}
            onClick={(event) => {
              if (!closeOnConfirm) event.preventDefault();
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
