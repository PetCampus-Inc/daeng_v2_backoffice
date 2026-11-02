import { useEffect, useId, useRef } from 'react';
import { create } from 'zustand';

/** 작성 중인 화면 하나. 이탈 확인창 본문과 [나가기] 때 입력을 버리는 방법을 준다. */
type LeaveGuard = { id: string; description: string; discard: () => void };

type LeaveGuardState = {
  guards: LeaveGuard[];
  /** 이탈 확인을 기다리는 화면 밖 동작(예: 로그아웃). [나가기]면 실행, [취소]면 버린다. */
  pendingAction: (() => void) | null;
  setGuard: (guard: LeaveGuard) => void;
  removeGuard: (id: string) => void;
  /** 작성 중인 화면이 있으면 확인창을 띄우고, 없으면 바로 실행한다. */
  requestLeave: (action: () => void) => void;
  clearPendingAction: () => void;
};

/**
 * 작성 중 이탈 확인(PRD 4.6). React Router는 이탈 차단(useBlocker)을 한 번에 하나만 지원하므로,
 * 각 화면은 '작성 중' 여부만 여기 올리고 차단과 확인창은 AppLayout 한 곳에서 맡는다.
 */
export const useLeaveGuardStore = create<LeaveGuardState>()((set, get) => ({
  guards: [],
  pendingAction: null,
  setGuard: (guard) => set((state) => ({ guards: [...state.guards.filter((item) => item.id !== guard.id), guard] })),
  removeGuard: (id) => set((state) => ({ guards: state.guards.filter((item) => item.id !== id) })),
  requestLeave: (action) => {
    if (get().guards.length === 0) action();
    else set({ pendingAction: action });
  },
  clearPendingAction: () => set({ pendingAction: null }),
}));

/** 작성 중(isDirty)인 동안 화면 이동·로그아웃·새로고침 전에 확인하게 한다. discard는 [나가기] 때 입력을 버린다. */
export function useLeaveGuard({
  isDirty,
  description,
  discard,
}: {
  isDirty: boolean;
  description: string;
  discard: () => void;
}) {
  const id = useId();
  const discardRef = useRef(discard);
  const setGuard = useLeaveGuardStore((state) => state.setGuard);
  const removeGuard = useLeaveGuardStore((state) => state.removeGuard);

  useEffect(() => {
    discardRef.current = discard;
  });

  useEffect(() => {
    if (!isDirty) return;
    setGuard({ id, description, discard: () => discardRef.current() });
    return () => removeGuard(id);
  }, [description, id, isDirty, removeGuard, setGuard]);
}
