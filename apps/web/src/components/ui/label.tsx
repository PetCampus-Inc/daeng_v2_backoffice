import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/** design.md 3.2 칸 이름. 본문 700. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot='label'
      className={cn('flex items-center gap-1 text-kd-body font-bold text-kd-foreground select-none', className)}
      {...props}
    />
  );
}

export { Label };
