import * as React from 'react';

import { useFieldControl } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * 입력칸·드롭다운이 같이 쓰는 테두리 모양(design.md 3.2).
 * 테두리 `--kd-neutral-200`, 모서리 12, 초점은 주황 2px, 오류(aria-invalid)면 테두리 `--kd-error-foreground`.
 */
const controlClassName =
  'rounded-kd-3 border border-kd-neutral-200 bg-kd-background text-kd-body text-kd-foreground transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid aria-invalid:border-kd-error-foreground disabled:cursor-not-allowed disabled:text-kd-neutral-400';

/**
 * design.md 3.2 입력칸. 높이 40, hover 시 테두리 `--kd-neutral-300`.
 * 오류는 `aria-invalid`, 읽기 전용 칸(구글 계정)은 `readOnly`로 표시한다(`--kd-surface` 배경, 회색 글자).
 */
function Input({ className, type, ...rest }: React.ComponentProps<'input'>) {
  const props = useFieldControl(rest);
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        controlClassName,
        'h-kd-control w-full min-w-0 px-3 placeholder:text-kd-neutral-400 not-disabled:not-read-only:not-aria-invalid:hover:border-kd-neutral-300 read-only:not-disabled:bg-kd-surface read-only:not-disabled:text-kd-foreground-muted',
        className
      )}
      {...props}
    />
  );
}

export { controlClassName, Input };
