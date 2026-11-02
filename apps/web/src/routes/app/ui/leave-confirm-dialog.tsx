import { useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

import { useLeaveGuardStore } from '@/store/leave-guard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/atoms/alert-dialog';

/**
 * 작성 중 이탈 확인창(PRD 4.6). 앱에서 이탈 차단(useBlocker)은 여기 한 곳에서만 건다.
 * - 다른 주소로 가는 이동(사이드바·브레드크럼·이전/다음·브라우저 뒤로)과 로그아웃 같은 화면 밖 동작에 같은 확인창을 띄운다.
 * - 새로고침·탭 닫기는 브라우저 기본 경고만 쓴다.
 * - [나가기]면 작성 중인 화면의 입력을 버리고 원래 동작을 계속하고, [취소]면 그대로 머문다.
 */
export function LeaveConfirmDialog() {
  const guards = useLeaveGuardStore((state) => state.guards);
  const pendingAction = useLeaveGuardStore((state) => state.pendingAction);
  const clearPendingAction = useLeaveGuardStore((state) => state.clearPendingAction);
  const isDirty = guards.length > 0;
  // [나가기] 뒤에 Radix가 닫힘(onOpenChange)을 다시 알려도 취소로 처리하지 않게 한다.
  const isConfirmingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`
  );
  useBeforeUnload(
    (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    { capture: true }
  );

  const isOpen = blocker.state === 'blocked' || pendingAction !== null;

  /** 머문다. 입력은 그대로 둔다. */
  const handleCancelLeave = () => {
    if (isConfirmingRef.current) {
      isConfirmingRef.current = false;
      return;
    }
    clearPendingAction();
    if (blocker.state === 'blocked') blocker.reset();
  };

  /** 작성 중인 입력을 모두 버리고 멈춰 둔 이동·동작을 계속한다. */
  const handleConfirmLeave = () => {
    isConfirmingRef.current = true;
    returnFocusRef.current = null;
    guards.forEach((guard) => guard.discard());
    clearPendingAction();
    if (blocker.state === 'blocked') blocker.proceed();
    pendingAction?.();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && isOpen && handleCancelLeave()}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          // 확인으로 이동한 경우에는 이전 화면으로 초점을 되돌리지 않는다.
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>작성 중인 내용이 사라집니다. 나갈까요?</AlertDialogTitle>
          <AlertDialogDescription>{guards.at(-1)?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmLeave}>나가기</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
