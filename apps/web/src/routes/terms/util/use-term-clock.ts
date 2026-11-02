import { useEffect, useState } from 'react';
import { kstDate } from './term-policy';
/** 열린 화면도 KST 자정 및 탭 복귀 시 상태를 다시 판정한다. */
export function useTermClock(refreshedAt: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(`${kstDate()}T00:00:00+09:00`).getTime() + 86400000;
    const timer = window.setTimeout(() => setNow(new Date()), Math.max(1, next - Date.now()));
    const refresh = () => setNow(new Date());
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [now]);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(timer);
  }, [refreshedAt]);
  return now;
}
