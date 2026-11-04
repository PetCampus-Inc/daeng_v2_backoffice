import { useLayoutEffect } from 'react';
import { useNavigationType } from 'react-router';

const SCROLL_POSITIONS = new Map<string, number>();

/**
 * 클릭할 행이 없는 목록용. 다른 메뉴에 갔다가 뒤로 돌아오면(POP) 같은 조건의 스크롤 위치를 한 번 복원한다.
 * 브라우저 기본 복원은 목록이 그려지기 전에 실행돼 실패하므로 목록이 보인 뒤(`isReady`)에 직접 복원한다.
 */
export function useScrollReturnPosition(key: string, isReady: boolean) {
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    const handleScroll = () => SCROLL_POSITIONS.set(key, window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [key]);

  useLayoutEffect(() => {
    if (!isReady) return;
    const top = SCROLL_POSITIONS.get(key);
    SCROLL_POSITIONS.delete(key);
    if (top !== undefined && navigationType === 'POP') window.scrollTo(0, top);
  }, [isReady, key, navigationType]);
}
