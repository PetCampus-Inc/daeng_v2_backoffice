import { Button } from '@/ui/atoms/button';
import { cn } from '@/util/cn';

/** 목록 상태별 문구와 버튼 이름(PRD KD3-578 4.5). */
const listStateCopy = {
  empty: { title: '등록된 항목이 없습니다.', description: undefined, actionLabel: undefined },
  'no-results': { title: '검색 결과가 없습니다.', description: undefined, actionLabel: '필터 초기화' },
  error: {
    title: '데이터를 불러오지 못했습니다.',
    description: '잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도',
  },
  forbidden: { title: '접근 권한이 없습니다.', description: undefined, actionLabel: '홈으로 이동' },
  // 없는 주소. 문구는 '상세 대상 없음'과 같고, 돌아갈 목록이 없어 홈으로 보낸다(개발에서 정함)
  'not-found': { title: '페이지를 찾을 수 없습니다.', description: undefined, actionLabel: '홈으로 이동' },
} as const;

type ListStateProps = { className?: string } & (
  | { kind: 'loading' | 'empty' }
  | { kind: 'no-results' | 'error' | 'forbidden' | 'not-found'; onAction: () => void }
);

/**
 * design.md 3.9 목록 상태. 화면 제목·툴바는 그대로 두고 표 자리에 넣는다(권한 없음은 툴바도 숨기고 본문 자리에).
 * - loading: 회색 막대 3줄 깜빡임, 글자 없음(화면 낭독기용 '불러오는 중입니다'만)
 * - empty: '등록된 항목이 없습니다.' 만들기 버튼은 두지 않는다(OQ-F1)
 * - no-results: '검색 결과가 없습니다.' + [필터 초기화]
 * - error: '데이터를 불러오지 못했습니다.' / '잠시 후 다시 시도해 주세요.' + [다시 시도]
 * - forbidden: '접근 권한이 없습니다.' + [홈으로 이동]
 * - not-found: '페이지를 찾을 수 없습니다.' + [홈으로 이동] (없는 주소)
 * 버튼이 있는 상태는 onAction으로 동작을 받는다.
 */
function ListState(props: ListStateProps) {
  const { className, kind } = props;

  if (kind === 'loading') {
    return (
      <div role='status' data-slot='list-state' className={cn('flex flex-col gap-3 px-4 py-14', className)}>
        <span className='sr-only'>불러오는 중입니다</span>
        {['w-full', 'w-[82%]', 'w-[64%]'].map((width) => (
          <div
            key={width}
            aria-hidden
            className={cn('h-4 animate-pulse rounded-kd-2 bg-kd-neutral-200 motion-reduce:animate-none', width)}
          />
        ))}
      </div>
    );
  }

  const copy = listStateCopy[kind];
  return (
    <div data-slot='list-state' className={cn('flex flex-col items-center px-4 py-14 text-center', className)}>
      <p className='text-kd-title-3 text-kd-foreground'>{copy.title}</p>
      {copy.description && <p className='mt-1 text-kd-sub text-kd-foreground-muted'>{copy.description}</p>}
      {'onAction' in props && copy.actionLabel && (
        <Button variant='outline' className='mt-4' onClick={props.onAction}>
          {copy.actionLabel}
        </Button>
      )}
    </div>
  );
}

export { ListState };
