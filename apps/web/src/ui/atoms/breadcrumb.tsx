import * as React from 'react';
import { Slot } from 'radix-ui';

import { cn } from '@/util/cn';

/**
 * design.md 2장 브레드크럼. 상세·작성 화면에서만 제목 바로 위 왼쪽(아래 간격 8)에 둔다.
 * 화면 낭독기용 이름은 '현재 위치'. 오른쪽 끝 이동 버튼(이전·다음)은 화면이 같은 줄에 따로 둔다.
 */
function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label='현재 위치' data-slot='breadcrumb' className={cn('mb-2', className)} {...props} />;
}

/** 단계 목록. 13/20 회색 글자, 단계 사이 간격 8. */
function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot='breadcrumb-list'
      className={cn('flex flex-wrap items-center gap-2 text-kd-sub text-kd-foreground-muted', className)}
      {...props}
    />
  );
}

/** 단계 하나. 메뉴 묶음 이름(예: '서비스 운영')은 링크 없이 글자만 넣는다. */
function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot='breadcrumb-item' className={cn('inline-flex items-center', className)} {...props} />;
}

/** 목록 이름. 글자 버튼이고 마우스를 올리면 진하게 + 밑줄. 라우터 Link는 asChild로 감싼다. */
function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a';

  return (
    <Comp
      data-slot='breadcrumb-link'
      className={cn(
        'rounded-kd-2 underline-offset-4 outline-none hover:text-kd-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid',
        className
      )}
      {...props}
    />
  );
}

/** 마지막 단계(현재 화면). 진한 600. */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot='breadcrumb-page'
      aria-current='page'
      className={cn('font-semibold text-kd-foreground', className)}
      {...props}
    />
  );
}

/** 단계 사이 '/'. `--kd-neutral-400`. */
function BreadcrumbSeparator({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot='breadcrumb-separator'
      role='presentation'
      aria-hidden='true'
      className={cn('text-kd-neutral-400', className)}
      {...props}
    >
      /
    </li>
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };
