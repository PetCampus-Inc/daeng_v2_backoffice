import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/ui/atoms/button';
import { cn } from '@/util/cn';

/** 확인창과 입력 창이 공유하는 열림 상태. */
function AlertDialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

/** 확인창을 여는 버튼. */
function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />;
}

/** 공통 패널. 확인창은 패널에, 입력 창은 첫 입력 요소에 초기 초점을 둔다. */
function AlertDialogContent({
  className,
  role = 'alertdialog',
  onOpenAutoFocus,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot='alert-dialog-overlay' className='fixed inset-0 z-50 bg-kd-overlay' />
      <DialogPrimitive.Content
        data-slot='alert-dialog-content'
        role={role}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-kd-dialog -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-kd-4 bg-kd-background p-6 text-kd-foreground shadow-kd-float outline-none',
          className
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (!event.defaultPrevented && role === 'alertdialog' && event.target instanceof HTMLElement) {
            event.preventDefault();
            event.target.focus({ preventScroll: true });
          }
        }}
        onPointerDownOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (target instanceof Element && target.closest('[data-sonner-toast]')) {
            event.preventDefault();
            return;
          }
          onPointerDownOutside?.(event);
        }}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

/** 제목과 본문을 묶는다. */
function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='alert-dialog-header' className={cn('grid gap-2', className)} {...props} />;
}

/** 버튼 줄. 오른쪽 정렬 [취소] [동작 이름]. */
function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='alert-dialog-footer' className={cn('flex justify-end gap-2', className)} {...props} />;
}

/** 제목. 제목 2, '…할까요?' 한 문장. */
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title data-slot='alert-dialog-title' className={cn('text-kd-title-2', className)} {...props} />
  );
}

/** 본문. 회색 1~2문장, 합니다체. */
function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot='alert-dialog-description'
      className={cn('text-kd-body text-kd-foreground-muted', className)}
      {...props}
    />
  );
}

/** 확인 버튼(동작 이름). 위험 동작이면 variant='destructive'(위험 채움). */
function AlertDialogAction({
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & { variant?: 'default' | 'destructive' }) {
  return (
    <Button variant={variant} asChild>
      <DialogPrimitive.Close data-slot='alert-dialog-action' {...props} />
    </Button>
  );
}

/** 취소 버튼(보조). */
function AlertDialogCancel({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <Button variant='outline' asChild>
      <DialogPrimitive.Close data-slot='alert-dialog-cancel' {...props} />
    </Button>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
