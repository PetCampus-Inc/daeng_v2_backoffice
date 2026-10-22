import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * design.md 3.5 카드. 흰 바탕, 1px `--kd-border`, 모서리 16, 그림자 없음.
 * 표 1개, 또는 상세 화면의 열 1개당 1개. 카드 안에 카드를 넣지 않는다.
 * 표 카드는 안쪽 여백 없이 툴바·표를 바로 넣는다.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card'
      className={cn(
        'flex flex-col overflow-hidden rounded-kd-4 border border-kd-border bg-kd-background text-kd-foreground',
        className
      )}
      {...props}
    />
  );
}

/** 카드 머리. 제목과 오른쪽 동작(예: '모두 읽음')을 한 줄에 두고 아래 구분선. */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-header'
      className={cn('flex items-center justify-between gap-3 border-b border-kd-border px-6 py-4', className)}
      {...props}
    />
  );
}

/** 카드·패널 제목. 제목 3(16/24/700). */
function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot='card-title' className={cn('text-kd-title-3', className)} {...props} />;
}

const cardContentVariants = cva('', {
  variants: {
    variant: {
      // 입력 폼 24
      form: 'p-6',
      // 정보 카드 20×24
      info: 'px-6 py-5',
    },
  },
  defaultVariants: {
    variant: 'form',
  },
});

/** 카드 본문. variant로 안쪽 여백(form 24, info 20×24)을 고른다. */
function CardContent({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardContentVariants>) {
  return <div data-slot='card-content' className={cn(cardContentVariants({ variant }), className)} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle };
