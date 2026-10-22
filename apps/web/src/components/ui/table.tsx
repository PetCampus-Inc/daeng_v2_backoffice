import * as React from 'react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * design.md 3.3 표. 최소 폭 860, 좁으면 열을 지우지 않고 표만 가로 스크롤한다.
 * 스크롤 영역은 키보드 초점을 받는다(4장). 화면 낭독기가 스크롤 영역을 부를 이름은 `scrollLabel`로 준다.
 */
function Table({ className, scrollLabel, ...props }: React.ComponentProps<'table'> & { scrollLabel?: string }) {
  return (
    <div
      data-slot='table-container'
      role={scrollLabel ? 'region' : undefined}
      aria-label={scrollLabel}
      tabIndex={0}
      className='relative w-full overflow-x-auto outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
    >
      <table
        data-slot='table'
        className={cn('w-full min-w-kd-table text-kd-body text-kd-foreground', className)}
        {...props}
      />
    </div>
  );
}

/** 표 머리 묶음. */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot='table-header' className={cn(className)} {...props} />;
}

/** 표 본문 묶음. 행마다 위쪽 1px `--kd-border`. */
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&>tr]:border-t [&>tr]:border-kd-border [&>tr]:hover:bg-kd-surface', className)}
      {...props}
    />
  );
}

/** 표 행. 본문 행은 hover 시 `--kd-surface`. 행 전체를 눌러 상세로 가게 하려면 onClick과 cursor-pointer를 준다. */
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr data-slot='table-row' className={cn('transition-colors', className)} {...props} />;
}

/**
 * 표 머리 칸. 높이 44, `--kd-surface` 배경, 캡션 회색.
 * 정렬 가능한 열은 `sort`로 현재 방향을 준다(↓ descending 최신 먼저 / ↑ ascending 오래된 먼저, aria-sort).
 * `onSort`를 주면 열 이름이 버튼이 된다.
 */
function TableHead({
  className,
  children,
  sort,
  onSort,
  ...props
}: React.ComponentProps<'th'> & { sort?: 'ascending' | 'descending' | 'none'; onSort?: () => void }) {
  const ArrowIcon = sort === 'ascending' ? ArrowUpIcon : sort === 'descending' ? ArrowDownIcon : null;
  const label = (
    <>
      {children}
      {ArrowIcon && <ArrowIcon aria-hidden className='size-3 shrink-0' />}
    </>
  );

  return (
    <th
      data-slot='table-head'
      aria-sort={sort}
      className={cn(
        'h-kd-table-head bg-kd-surface px-4 text-left align-middle text-kd-caption font-semibold whitespace-nowrap text-kd-foreground-muted',
        className
      )}
      {...props}
    >
      {onSort ? (
        <button
          type='button'
          onClick={onSort}
          className='inline-flex items-center gap-1 rounded-kd-2 outline-none not-disabled:hover:text-kd-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
        >
          {label}
        </button>
      ) : (
        <span className='inline-flex items-center gap-1'>{label}</span>
      )}
    </th>
  );
}

/**
 * 표 칸. 행 높이 64, 좌우 16, 한 줄.
 * 열 폭은 w-kd-col-number(번호 104)·w-kd-col-status(상태 112)·w-kd-col-time(시각 176), 숫자 열은 text-right.
 */
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn('h-kd-table-row px-4 align-middle whitespace-nowrap', className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
