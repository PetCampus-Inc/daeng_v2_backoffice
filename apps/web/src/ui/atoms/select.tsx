import * as React from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';

import { useFieldControl } from '@/ui/atoms/field';
import { controlClassName } from '@/ui/atoms/input';
import { cn } from '@/util/cn';

/** design.md 3.2 드롭다운. 선택지가 6개 이상일 때 쓴다(5개 이하는 RadioGroup 버튼형 단일 선택). */
function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot='select' {...props} />;
}

/** 드롭다운에 고른 값(없으면 placeholder)을 보여 준다. */
function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot='select-value' {...props} />;
}

/** 드롭다운 칸. 입력칸과 같은 높이 40·테두리·hover·오류(aria-invalid) 모양. */
function SelectTrigger({ className, children, ...rest }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const props = useFieldControl(rest);
  return (
    <SelectPrimitive.Trigger
      data-slot='select-trigger'
      className={cn(
        controlClassName,
        'flex h-kd-control w-full items-center justify-between gap-2 px-3 whitespace-nowrap not-disabled:not-aria-invalid:hover:border-kd-neutral-300 data-placeholder:text-kd-neutral-400 *:data-[slot=select-value]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className='size-4 text-kd-foreground-muted' />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** 드롭다운 목록. 칸 바로 아래에 칸과 같은 폭으로 열린다. */
function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot='select-content'
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-kd-2 border border-kd-neutral-200 bg-kd-background p-1 text-kd-foreground shadow-kd-float',
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/** 드롭다운 선택지. 높이 36, 고른 항목은 오른쪽에 체크 표시. */
function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot='select-item'
      className={cn(
        'relative flex h-kd-menu-item w-full cursor-default items-center rounded-kd-2 pr-8 pl-3 text-kd-body outline-hidden select-none focus:bg-kd-surface data-disabled:pointer-events-none data-disabled:text-kd-neutral-400',
        className
      )}
      {...props}
    >
      <span className='pointer-events-none absolute right-3 flex size-4 items-center justify-center'>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className='size-4' />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/** 목록이 길 때 위로 스크롤하는 영역. */
function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot='select-scroll-up-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className='size-4' />
    </SelectPrimitive.ScrollUpButton>
  );
}

/** 목록이 길 때 아래로 스크롤하는 영역. */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot='select-scroll-down-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className='size-4' />
    </SelectPrimitive.ScrollDownButton>
  );
}

export { Select, SelectContent, SelectItem, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger, SelectValue };
