import { cn } from '@/util/cn';

/** 홈의 불러오는 중 숫자·그래프 자리 회색 막대. 크기는 className으로 정한다. 움직임 줄이기 설정이면 깜빡이지 않는다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-kd-2 bg-kd-neutral-200 motion-reduce:animate-none', className)}
    />
  );
}
