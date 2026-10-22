import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-kd-badge w-fit shrink-0 items-center justify-center rounded-kd-full border px-2.5 text-kd-caption font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        // 회색 기본: 끝났거나 아직 안 나감
        default: 'border-kd-neutral-200 bg-kd-surface text-kd-foreground-muted',
        // 초록: 정상 적용 중
        success: 'border-kd-success-border bg-kd-success-background text-kd-success-foreground',
        // 노랑: 우리가 처리할 차례
        warning: 'border-kd-warning-border bg-kd-warning-background text-kd-warning-foreground',
        // 파랑: 진행 중 / 앞으로 적용
        info: 'border-kd-info-border bg-kd-info-background text-kd-info-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * design.md 3.4 상태 배지. 상태에만 쓰고, 글자가 상태를 말한다(앞에 기호를 붙이지 않는다).
 * variant로 색(default 회색·success·warning·info)을 고른다. 빨강은 1단계 상태에 쓰지 않아 두지 않았다.
 */
function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot='badge' data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
