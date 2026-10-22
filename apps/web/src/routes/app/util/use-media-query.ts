import { useSyncExternalStore } from 'react';

/** 사이드바가 펼친 채 시작하고 본문 옆에 붙는 폭(design.md 1.6). */
export const WIDE_QUERY = '(min-width: 1200px)';

/** 미디어 쿼리가 지금 맞는지. 창 폭이 바뀌면 다시 그린다. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );
}
