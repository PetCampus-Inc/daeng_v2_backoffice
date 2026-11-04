import { useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/ui/atoms/alert-dialog';
import {
  getTermChangeMutationKey,
  useInvalidateTerms,
  useTermChangeOptions,
  useTermDeleteOptions,
} from '../api/term-query';
import { useDeleteTermsVersion, useWithdrawTermsVersion } from '../api/use-terms';
import { TERM_KIND_LABELS, type TermSummary } from '../type/term-ui';
import { getTermErrorGuide, readTermError } from '../util/term-error';
import { displayTermDate } from '../util/term-policy';

/**
 * 초안 삭제와 공개 철회 확인창. 서버는 이 두 동작에서 버전 충돌(`version`)을 확인하지 않아 번호만 보낸다(OQ-D32).
 * 서버가 거절하면(이미 공개·삭제됨 409, 철회 불가 409, 없음 404) 최신 상태를 다시 읽는다.
 */
export function TermConfirm({
  term,
  action,
  onDeleted,
  onFailed,
}: {
  term: TermSummary;
  action: 'delete' | 'withdraw';
  onDeleted?: () => void;
  onFailed?: (status: number | undefined, code: string | undefined) => void;
}) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const deleteMutation = useDeleteTermsVersion(useTermDeleteOptions(email));
  const withdrawMutation = useWithdrawTermsVersion(useTermChangeOptions(email));
  const invalidateTerms = useInvalidateTerms();
  const isMutating = action === 'delete' ? deleteMutation.isPending : withdrawMutation.isPending;
  const isPending = useIsMutating({ mutationKey: getTermChangeMutationKey(email) }) > 0;
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = action === 'delete' ? '초안 삭제' : '공개 철회';
  const handleConfirm = async () => {
    if (busy.current || isPending) return;
    busy.current = true;
    try {
      // 화면의 버전 번호(`version`)가 서버 `id`다.
      if (action === 'delete') await deleteMutation.mutateAsync({ id: term.version });
      else await withdrawMutation.mutateAsync({ id: term.version });
      setOpen(false);
      toast.success(action === 'delete' ? '초안을 삭제했습니다.' : '공개를 철회했습니다.');
      if (action === 'delete') onDeleted?.();
    } catch (error) {
      const { status, code } = readTermError(error);
      setOpen(false);
      if (action === 'delete' && onFailed) {
        onFailed(status, code);
      } else {
        const guide = status === 404 || status === 409 ? getTermErrorGuide(status, code) : null;
        if (guide) {
          toast.error(guide.description);
          invalidateTerms();
        } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
      }
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <Button ref={triggerRef} variant='destructive-outline' disabled={isPending} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => !isMutating && setOpen(value)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (triggerRef.current?.isConnected && !triggerRef.current.disabled) {
              triggerRef.current.focus({ preventScroll: true });
            } else document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{action === 'delete' ? '초안을 삭제할까요?' : '공개를 철회할까요?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'delete'
                ? `'${TERM_KIND_LABELS[term.kind]}' 초안을 삭제합니다. 삭제한 초안은 복구할 수 없습니다.`
                : `버전 #${term.version}(시행일 ${displayTermDate(term.effectiveDate)})입니다. 철회하면 앱에서 바로 보이지 않고, 같은 버전을 다시 공개할 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isMutating && <p role='status'>{label} 중…</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
