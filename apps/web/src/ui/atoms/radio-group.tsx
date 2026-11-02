import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';

import { useFieldControl } from '@/ui/atoms/field';
import { cn } from '@/util/cn';

/**
 * design.md 3.2 버튼형 단일 선택. 선택지가 5개 이하(직무, 역할)일 때 쓴다.
 * 화살표 키로 고르는 라디오 그룹이다. 오류는 이 요소에 `aria-invalid`를 준다.
 */
function RadioGroup({ className, ...rest }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const props = useFieldControl(rest, { labelledBy: true });
  return (
    <RadioGroupPrimitive.Root
      data-slot='radio-group'
      className={cn('group/radio-group flex flex-wrap gap-2', className)}
      {...props}
    />
  );
}

/** 선택지 하나. 버튼 모양이고, 고른 것은 진한 배경 흰 글자. 글자는 children으로 넣는다. */
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot='radio-group-item'
      className={cn(
        'inline-flex h-kd-control shrink-0 items-center justify-center rounded-kd-3 border border-kd-neutral-200 bg-kd-background px-4 text-kd-body font-bold whitespace-nowrap text-kd-foreground transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid disabled:cursor-not-allowed disabled:text-kd-neutral-400 data-[state=unchecked]:not-disabled:hover:bg-kd-surface group-aria-invalid/radio-group:data-[state=unchecked]:border-kd-error-foreground data-[state=checked]:border-kd-foreground data-[state=checked]:bg-kd-foreground data-[state=checked]:text-kd-background',
        className
      )}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
