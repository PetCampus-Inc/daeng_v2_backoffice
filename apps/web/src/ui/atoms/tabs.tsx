import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';

import { cn } from '@/util/cn';

/** 같은 화면 안에서 보기를 번갈아 바꾸는 탭. 좌우 방향키·Home·End로 옮기고, 눌러서 제출하는 버튼이 아니다. */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot='tabs' className={cn('min-w-0', className)} {...props} />;
}

/** 탭 이름이 가로로 늘어선 줄. 아래에 얇은 구분선이 깔린다. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot='tabs-list'
      className={cn('flex gap-6 border-b border-kd-border', className)}
      {...props}
    />
  );
}

/** 탭 이름 하나. 고른 탭은 진한 글자와 아래 굵은 밑줄, 나머지는 흐린 글자. 글자는 children으로 넣는다. */
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot='tabs-trigger'
      className={cn(
        '-mb-px inline-flex h-kd-control shrink-0 items-center border-b-2 border-transparent px-1 text-kd-body font-bold whitespace-nowrap text-kd-foreground-muted transition-colors outline-none select-none hover:text-kd-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid disabled:cursor-not-allowed disabled:text-kd-neutral-400 data-[state=active]:border-kd-primary data-[state=active]:text-kd-foreground',
        className
      )}
      {...props}
    />
  );
}

/** 탭 하나에 대응하는 내용. 좁은 화면에서만 숨기고 싶으면 `forceMount`와 `className`으로 직접 숨긴다. */
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot='tabs-content' className={cn('outline-none', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
