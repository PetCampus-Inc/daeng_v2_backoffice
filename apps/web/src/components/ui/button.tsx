import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // 주요
        default: 'bg-kd-primary text-kd-primary-foreground not-disabled:hover:bg-kd-primary-hover disabled:opacity-45',
        // 보조
        outline:
          'border-kd-neutral-200 bg-kd-background text-kd-foreground not-disabled:hover:bg-kd-surface disabled:text-kd-neutral-400',
        // 위험 채움 — 확인창 안에서만
        destructive:
          'bg-kd-error-foreground text-kd-background not-disabled:hover:bg-kd-error-hover disabled:opacity-45',
        // 위험 테두리
        'destructive-outline':
          'border-kd-error-border bg-kd-background text-kd-error-foreground not-disabled:hover:bg-kd-error-background disabled:text-kd-neutral-400',
        // 위험 글자
        'destructive-ghost':
          'text-kd-error-foreground not-disabled:hover:bg-kd-error-background disabled:text-kd-neutral-400',
        // 링크형
        link: 'text-kd-primary underline-offset-4 not-disabled:hover:underline disabled:text-kd-neutral-400',
      },
      size: {
        // 본문 14/20, 버튼은 700
        default: 'h-kd-control rounded-kd-3 px-4 text-kd-body font-bold',
        // 작은: 높이 32, 캡션 12/18
        sm: 'h-kd-control-small rounded-kd-2 px-3 text-kd-caption font-semibold',
        // 상단바 ☰·알림 아이콘 버튼 40×40, 아이콘 20
        icon: "size-kd-control rounded-kd-3 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [
      // 링크형은 보조 글자 13/20
      {
        variant: 'link',
        size: 'default',
        class: 'text-kd-sub font-semibold',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * design.md 3.1 버튼. variant로 종류(주요·보조·위험·링크형), size로 크기(기본·작은·아이콘)를 고른다.
 */
function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot='button'
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
