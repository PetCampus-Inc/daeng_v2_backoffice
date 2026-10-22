import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** design.md 3.3 표 바닥줄의 페이지 번호. 가운데 정렬. */
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label='페이지 번호'
      data-slot='pagination'
      className={cn('flex w-full justify-center', className)}
      {...props}
    />
  );
}

/** 페이지 번호 목록. */
function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot='pagination-content' className={cn('flex items-center gap-1', className)} {...props} />;
}

/** 페이지 번호 목록의 한 칸. */
function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot='pagination-item' {...props} />;
}

/** 페이지 번호 버튼(32×32, 고정폭 숫자). 현재 페이지는 isActive로 주고 aria-current="page"가 붙는다. */
function PaginationButton({ className, isActive, ...props }: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      type='button'
      aria-current={isActive ? 'page' : undefined}
      data-slot='pagination-button'
      data-active={isActive}
      className={cn(
        'inline-flex size-kd-control-small items-center justify-center rounded-kd-2 border border-transparent text-kd-caption font-semibold text-kd-foreground tabular-nums outline-none not-disabled:hover:bg-kd-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid aria-[current=page]:border-kd-neutral-200 aria-[current=page]:font-bold',
        className
      )}
      {...props}
    />
  );
}

/** 이전 페이지 버튼. 갈 수 없으면 disabled. */
function PaginationPrevious({ children = '이전', ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant='outline' size='sm' data-slot='pagination-previous' {...props}>
      {children}
    </Button>
  );
}

/** 다음 페이지 버튼. 갈 수 없으면 disabled. */
function PaginationNext({ children = '다음', ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant='outline' size='sm' data-slot='pagination-next' {...props}>
      {children}
    </Button>
  );
}

/** 생략된 페이지 번호 자리(…). */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot='pagination-ellipsis'
      className={cn(
        'flex size-kd-control-small items-center justify-center text-kd-caption text-kd-foreground-muted',
        className
      )}
      {...props}
    >
      …
    </span>
  );
}

export {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
};
