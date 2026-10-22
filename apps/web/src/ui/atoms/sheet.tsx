import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { cn } from '@/util/cn';

/**
 * design.md 1.6 좁은 화면(1199px 이하)의 사이드바. 상단바 바로 아래에서 본문 위에 겹쳐 열린다.
 * Esc·막 클릭으로 닫히고, 열리면 초점을 안으로 옮긴다.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot='sheet' {...props} />;
}

/**
 * 시트 본체. 왼쪽 고정, 폭 240, 그림자. 상단바(64) 아래 본문을 반투명 막으로 덮는다.
 * 화면 낭독기용 제목은 SheetTitle(sr-only)로 넣는다.
 */
function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot='sheet-overlay'
        className='fixed inset-x-0 top-kd-topbar bottom-0 z-30 bg-kd-overlay data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none'
      />
      <SheetPrimitive.Content
        data-slot='sheet-content'
        aria-describedby={undefined}
        className={cn(
          'fixed top-kd-topbar bottom-0 left-0 z-30 flex w-kd-sidebar flex-col overflow-y-auto bg-kd-background text-kd-foreground shadow-kd-float outline-hidden data-open:animate-in data-open:slide-in-from-left-10 data-closed:animate-out data-closed:slide-out-to-left-10 motion-reduce:animate-none',
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

/** 시트 제목. 화면 낭독기용이라 보통 sr-only로 둔다. */
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot='sheet-title' className={cn('text-kd-title-3', className)} {...props} />;
}

export { Sheet, SheetContent, SheetTitle };
