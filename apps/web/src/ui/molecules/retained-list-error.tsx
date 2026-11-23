import { Button } from '@/ui/atoms/button';
import { cn } from '@/util/cn';

/** 목록 조회가 실패했지만 이전 결과를 보여 줄 때 쓰는 안내. 놓이는 자리에 맞게 className으로 여백을 정한다. */
export function RetainedListError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 px-4 pb-2', className)}>
      <p role='status' className='text-kd-sub'>
        조회 실패 · 이전 조회 결과를 표시합니다.
      </p>
      <Button variant='link' onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
