import type { ReactNode } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/ui/atoms/alert-dialog';
import { Button } from '@/ui/atoms/button';

/** 팀원 입력 폼의 헤더와 닫기 처리를 구성한다. */
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
  <AlertDialog open onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
    <AlertDialogContent
      role='dialog'
      aria-describedby={undefined}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
      className='block'
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
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <Button
          variant='ghost'
          size='sm'
          aria-label='창 닫기'
          aria-disabled={isPending}
          onClick={() => {
            if (!isPending) onClose();
          }}
        >
          ×
        </Button>
      </div>
      {children}
    </AlertDialogContent>
  </AlertDialog>
);
