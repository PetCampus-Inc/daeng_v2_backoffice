import { useLayoutEffect } from 'react';

type ListPosition = { id: number; x: number; y: number; tableX: number };
const RETURN_POSITIONS = new Map<string, ListPosition>();

/** 같은 계정·조건의 목록으로 돌아오면 읽던 행과 스크롤을 한 번 복원한다. */
export function useListReturnPosition(key: string, isReady: boolean) {
  useLayoutEffect(() => {
    if (!isReady) return;
    const position = RETURN_POSITIONS.get(key);
    if (!position) return;
    const target = document.querySelector<HTMLButtonElement>(`[data-list-item-id="${position.id}"]`);
    RETURN_POSITIONS.delete(key);
    if (!target) return;
    target.focus({ preventScroll: true });
    const table = target.closest('[data-slot="table-container"]');
    if (table) table.scrollLeft = position.tableX;
    window.scrollTo(position.x, position.y);
  }, [isReady, key]);

  return (id: number) => {
    const target = document.querySelector<HTMLButtonElement>(`[data-list-item-id="${id}"]`);
    RETURN_POSITIONS.clear();
    RETURN_POSITIONS.set(key, {
      id,
      x: window.scrollX,
      y: window.scrollY,
      tableX: target?.closest('[data-slot="table-container"]')?.scrollLeft ?? 0,
    });
  };
}
