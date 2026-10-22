import * as React from 'react';
import { EllipsisIcon } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/** design.md 3.3 행 끝 ⋯ 메뉴. 행 동작이 2개 이상일 때 쓴다. */
function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot='dropdown-menu' {...props} />;
}

/**
 * ⋯ 버튼(32×32). 화면 낭독기용 이름은 aria-label로 꼭 준다.
 * 행 클릭(상세 이동)으로 번지지 않게 클릭을 막는다.
 */
function DropdownMenuTrigger({
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>, 'children' | 'asChild'> & {
  'aria-label': string;
}) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot='dropdown-menu-trigger'
      className={cn(
        'inline-flex size-kd-control-small shrink-0 items-center justify-center rounded-kd-2 text-kd-foreground-muted outline-none not-disabled:hover:bg-kd-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid disabled:cursor-not-allowed disabled:text-kd-neutral-400 data-[state=open]:bg-kd-neutral-200',
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...props}
    >
      <EllipsisIcon aria-hidden className='size-4' />
    </DropdownMenuPrimitive.Trigger>
  );
}

/**
 * 메뉴 목록. ⋯ 바로 아래에 오른쪽 끝을 맞춰 열린다. 최소 폭 140, 흰 바탕, `--kd-neutral-200` 테두리, 모서리 8, 그림자.
 * 포털 안의 클릭이 React 트리를 따라 행으로 번지지 않게 막는다.
 */
function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 4,
  onClick,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot='dropdown-menu-content'
        side='bottom'
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-kd-menu origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-kd-2 border border-kd-neutral-200 bg-kd-background p-1 text-kd-foreground shadow-kd-float',
          className
        )}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/** 메뉴 항목. 높이 36, 위험 항목은 variant='destructive'(빨간 글자). */
function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { variant?: 'default' | 'destructive' }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot='dropdown-menu-item'
      data-variant={variant}
      className={cn(
        'flex h-kd-menu-item cursor-default items-center rounded-kd-2 px-3 text-kd-body whitespace-nowrap outline-hidden select-none focus:bg-kd-surface data-disabled:pointer-events-none data-disabled:text-kd-neutral-400 data-[variant=destructive]:text-kd-error-foreground data-[variant=destructive]:focus:bg-kd-error-background',
        className
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
