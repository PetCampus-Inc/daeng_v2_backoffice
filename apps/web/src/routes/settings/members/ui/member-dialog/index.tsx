import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from '@/ui/atoms/button';

/** 입력 창은 확인 전용 AlertDialog와 구분해 기존 Radix Dialog로 구성한다. */
export const MemberDialog = ({
  title,
  children,
  onClose,
  isPending,
  onRestoreFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  isPending: boolean;
  onRestoreFocus: () => void;
}) => (
  <Dialog.Root open onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className='fixed inset-0 z-40 bg-kd-overlay' />
      <Dialog.Content
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className='fixed top-1/2 left-1/2 z-50 max-h-[calc(100svh-32px)] w-[calc(100%-32px)] max-w-kd-dialog -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-kd-4 bg-kd-background p-6 shadow-kd-float outline-none'
        // 창 바깥 클릭만 닫기로 본다. 앱 이탈 확인창으로 초점이 옮겨 가는 것(focus outside)은 닫기가 아니다.
        onPointerDownOutside={(event) => {
          event.preventDefault();
          if (!isPending) onClose();
        }}
        onFocusOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (!isPending) onClose();
        }}
      >
        <div className='mb-6 flex items-center justify-between gap-4'>
          <Dialog.Title className='text-kd-title-2'>{title}</Dialog.Title>
          <Button variant='ghost' size='sm' aria-label='창 닫기' onClick={onClose} disabled={isPending}>
            ×
          </Button>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
