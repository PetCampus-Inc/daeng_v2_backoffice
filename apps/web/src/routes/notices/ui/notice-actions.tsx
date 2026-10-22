import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState } from 'react';
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
import { useChangeNotice } from '../api/notices/index';
import type { Notice } from '../type/notice';

/** 목록·읽기·초안 화면에서 동일한 상태 전환과 확인창을 쓴다. */
export function NoticeActions({
  notice,
  onDeleted,
  title = notice.title,
  showRepublish = false,
}: {
  notice: Notice;
  onDeleted?: () => void;
  title?: string;
  showRepublish?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const mutation = useChangeNotice(user?.email ?? '');
  const isPending = useIsMutating({ mutationKey: ['notices', user?.email ?? '', 'change'] }) > 0;
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isBusy = useRef(false);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  if (!user || user.role === 'viewer') return null;
  const action = notice.status === 'draft' ? 'delete' : notice.status === 'published' ? 'unpublish' : 'republish';
  if (action === 'republish' && !showRepublish) return null;
  const label = action === 'delete' ? '초안 삭제' : action === 'unpublish' ? '게시 해제' : '공지 재게시';

  const handleAction = async (undoNotice?: Notice) => {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      const target = undoNotice ?? notice;
      const updated = await mutation.mutateAsync({
        id: target.id,
        revision: target.revision,
        action: undoNotice ? 'undo' : action,
      });
      setIsConfirmOpen(false);
      if (undoNotice) toast.success('게시 해제를 취소했습니다.');
      else if (action === 'delete') {
        toast.success('초안을 삭제했습니다.');
        onDeleted?.();
      } else if (action === 'unpublish' && updated) {
        toast.success('게시를 해제했습니다.', {
          duration: 8000,
          action: { label: '실행 취소', onClick: () => void handleAction(updated) },
        });
      } else toast.success('공지를 다시 게시했습니다.');
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 404 || status === 409) {
        toast.error('공지 상태가 변경되었습니다. 최신 상태를 확인해 주세요.');
        void queryClient.invalidateQueries({ queryKey: ['notices', user.email] });
      } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      isBusy.current = false;
    }
  };

  return (
    <>
      <Button
        ref={actionButtonRef}
        variant={action === 'republish' ? 'default' : 'destructive-outline'}
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          if (action === 'unpublish') void handleAction();
          else setIsConfirmOpen(true);
        }}
      >
        {mutation.isPending ? `${label} 중…` : label}
      </Button>
      <AlertDialog open={isConfirmOpen} onOpenChange={(open) => !isPending && setIsConfirmOpen(open)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            actionButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'delete' ? '초안을 삭제할까요?' : '공지를 다시 게시할까요?'}
            </AlertDialogTitle>
            <AlertDialogDescription className='[overflow-wrap:anywhere]'>
              {action === 'delete'
                ? `'${title || '제목 없음'}' 초안을 삭제합니다. 삭제한 초안은 복구할 수 없습니다.`
                : '앱에 다시 노출됩니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant={action === 'delete' ? 'destructive' : 'default'}
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleAction();
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
