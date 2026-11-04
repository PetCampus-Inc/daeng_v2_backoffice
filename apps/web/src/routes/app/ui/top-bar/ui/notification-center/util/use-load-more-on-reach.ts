import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * 스크롤 영역 맨 아래 표지(sentinel)가 보이면 `onReach`를 부른다(`IntersectionObserver`).
 * 돌려주는 ref 함수를 표지 요소에 달면 된다. 표지가 다시 나타날 때마다 새로 관찰하므로,
 * 다음 페이지를 받은 뒤에도 표지가 아직 보이면 이어서 부른다.
 */
export function useLoadMoreOnReach(rootRef: RefObject<HTMLElement | null>, onReach: () => void) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const onReachRef = useRef(onReach);

  useEffect(() => {
    onReachRef.current = onReach;
  });

  useEffect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onReachRef.current();
      },
      { root: rootRef.current }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, rootRef]);

  return setSentinel;
}
