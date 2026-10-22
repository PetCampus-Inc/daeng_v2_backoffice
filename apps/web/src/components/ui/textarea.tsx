import * as React from 'react';

import { useFieldControl } from '@/components/ui/field';
import { controlClassName } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * design.md 3.2 여러 줄 입력칸. 테두리·hover·오류·읽기 전용은 Input과 같고, 긴 글이라 줄 높이 24.
 */
function Textarea({ className, ...rest }: React.ComponentProps<'textarea'>) {
  const props = useFieldControl(rest);
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        controlClassName,
        'flex field-sizing-content min-h-16 w-full resize-none px-3 py-3 leading-6 placeholder:text-kd-neutral-400 not-disabled:not-read-only:not-aria-invalid:hover:border-kd-neutral-300 read-only:not-disabled:bg-kd-surface read-only:not-disabled:text-kd-foreground-muted',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
