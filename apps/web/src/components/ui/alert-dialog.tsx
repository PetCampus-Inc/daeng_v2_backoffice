import * as React from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * design.md 3.6 확인창. 열리면 초점은 '취소'(AlertDialogCancel), Esc·바탕 클릭으로 닫히고,
 * 닫히면 초점이 연 버튼으로 돌아간다.
 */
function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot='alert-dialog' {...props} />;
}

/** 확인창을 여는 버튼. */
function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />;
}

/**
 * 확인창 본체. 화면 가운데, 최대 폭 440, 모서리 16, 뒤 바탕 어둡게.
 * Radix 확인창은 바깥 클릭을 막으므로, 화면 전체를 덮는 본체 안에 바탕을 두고 바탕을 누르면 닫히게 했다.
 */
function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Content
        data-slot='alert-dialog-content'
        className='fixed inset-0 z-50 grid place-items-center p-4 outline-none'
        {...props}
      >
        {/* 바탕: 누르면 닫힌다. 키보드로는 Esc를 쓴다. */}
        <AlertDialogPrimitive.Action asChild>
          <div aria-hidden tabIndex={-1} data-slot='alert-dialog-overlay' className='absolute inset-0 bg-kd-overlay' />
        </AlertDialogPrimitive.Action>
        <div
          data-slot='alert-dialog-panel'
          className={cn(
            'relative grid w-full max-w-kd-dialog gap-6 rounded-kd-4 bg-kd-background p-6 text-kd-foreground shadow-kd-float',
            className
          )}
        >
          {children}
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
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
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot='alert-dialog-title'
      className={cn('text-kd-title-2', className)}
      {...props}
    />
  );
}

/** 본문. 회색 1~2문장, 합니다체. */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
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
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & { variant?: 'default' | 'destructive' }) {
  return (
    <Button variant={variant} asChild>
      <AlertDialogPrimitive.Action data-slot='alert-dialog-action' {...props} />
    </Button>
  );
}

/** 취소 버튼(보조). 열릴 때 초점을 받는다. */
function AlertDialogCancel({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <Button variant='outline' asChild>
      <AlertDialogPrimitive.Cancel data-slot='alert-dialog-cancel' {...props} />
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
