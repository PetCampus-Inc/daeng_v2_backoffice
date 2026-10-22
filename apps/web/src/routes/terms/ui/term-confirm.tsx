import { useRef, useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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
import { useChangeTerm } from '../api/terms';
import { TERM_KIND_LABELS, type Term } from '../type/term';
import { displayTermDate } from '../util/term-policy';
export function TermConfirm({
  term,
  action,
  onDeleted,
  onFailed,
}: {
  term: Term;
  action: 'delete' | 'withdraw';
  onDeleted?: () => void;
  onFailed?: (status: number | undefined) => void;
}) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const mutation = useChangeTerm(email);
  const client = useQueryClient();
  const isPending = useIsMutating({ mutationKey: ['terms', email, 'change'] }) > 0;
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = action === 'delete' ? '초안 삭제' : '공개 철회';
  const handleConfirm = async () => {
    if (busy.current || isPending) return;
    busy.current = true;
    try {
      await mutation.mutateAsync({ kind: term.kind, version: term.version, revision: term.revision, action });
      setOpen(false);
      toast.success(action === 'delete' ? '초안을 삭제했습니다.' : '공개를 철회했습니다.');
      if (action === 'delete') onDeleted?.();
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      setOpen(false);
      if (action === 'delete' && onFailed) {
        onFailed(status);
      } else if (status === 409 || status === 404) {
        toast.error('약관 상태가 변경되어 요청을 완료하지 못했습니다. 최신 상태를 확인해 주세요.');
        void client.invalidateQueries({ queryKey: ['terms', email] });
      } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <Button ref={triggerRef} variant='destructive-outline' disabled={isPending} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => !mutation.isPending && setOpen(value)}>
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
          {mutation.isPending && <p role='status'>{label} 중…</p>}
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
