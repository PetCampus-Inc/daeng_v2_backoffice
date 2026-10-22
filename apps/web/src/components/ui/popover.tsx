import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/** design.md 3.8 팝오버(알림 센터·프로필). 바깥 클릭·Esc로 닫히고, 닫히면 초점이 연 버튼으로 돌아간다. */
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

/** 팝오버를 여는 버튼. */
function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

/**
 * 팝오버 본체. 흰 바탕, `--kd-neutral-200` 테두리, 모서리 12, 그림자, 폭 380.
 * 연 버튼의 오른쪽 끝에 맞춰 아래로 열린다. 안쪽 여백은 머리·본문이 각자 갖는다.
 */
function PopoverContent({
  className,
  align = 'end',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot='popover-content'
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 flex w-kd-popover max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-kd-3 border border-kd-neutral-200 bg-kd-background text-kd-foreground shadow-kd-float outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/** 팝오버 머리. 제목과 오른쪽 동작(예: '모두 읽음')을 한 줄에 두고 아래 구분선. */
function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='popover-header'
      className={cn('flex items-center justify-between gap-3 border-b border-kd-border px-6 py-4', className)}
      {...props}
    />
  );
}

/** 팝오버 제목. 제목 3. */
function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot='popover-title' className={cn('text-kd-title-3', className)} {...props} />;
}

export { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger };
