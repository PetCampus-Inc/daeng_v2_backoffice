import { useIsMutating } from '@tanstack/react-query';
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
import {
  getNoticeChangeMutationKey,
  useInvalidateNotices,
  useNoticeChangeOptions,
  useNoticeDeleteOptions,
} from '../api/notice-query';
import { useDeleteNotice, usePublishNotice, useUnpublishNotice } from '../api/use-notices';
import type { Notice as ServerNotice } from '../type';
import type { NoticeSummary } from '../type/notice-ui';
import { getNoticeErrorGuide, readNoticeError } from '../util/notice-error';

const GENERIC_ERROR_MESSAGE = '일시적 오류로 요청을 완료하지 못했습니다.';
const STATE_CHANGED_MESSAGE = '공지 상태가 변경되었습니다. 최신 상태를 확인해 주세요.';

/**
 * 목록·읽기·초안 화면에서 동일한 상태 전환과 확인창을 쓴다.
 * 재게시는 읽기 화면만 하며 최신 `version`이 필요해 `version`을 함께 받는다. 게시 해제·삭제는 서버가 `version`을 확인하지 않는다.
 */
export function NoticeActions({
  notice,
  version,
  onDeleted,
  title = notice.title,
  showRepublish = false,
}: {
  notice: NoticeSummary;
  version?: number;
  onDeleted?: () => void;
  title?: string;
  showRepublish?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const email = user?.email ?? '';
  const changeOptions = useNoticeChangeOptions(email);
  const deleteMutation = useDeleteNotice(useNoticeDeleteOptions(email));
  const unpublishMutation = useUnpublishNotice(changeOptions);
  const publishMutation = usePublishNotice(changeOptions);
  const invalidateNotices = useInvalidateNotices();
  const isPending = useIsMutating({ mutationKey: getNoticeChangeMutationKey(email) }) > 0;
  const [isRunning, setIsRunning] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isBusy = useRef(false);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  if (!user || user.role === 'VIEWER') return null;
  const action = notice.status === 'draft' ? 'delete' : notice.status === 'published' ? 'unpublish' : 'republish';
  if (action === 'republish' && !showRepublish) return null;
  const label = action === 'delete' ? '초안 삭제' : action === 'unpublish' ? '게시 해제' : '공지 재게시';

  /** 요청이 거절되면 상태가 바뀐 것으로 보고 최신 상태를 다시 읽는다. */
  const handleFailure = (error: unknown) => {
    const { status, code } = readNoticeError(error);
    if (status === 404 || status === 409) {
      toast.error(STATE_CHANGED_MESSAGE);
      invalidateNotices();
    } else if (status === 400) toast.error(getNoticeErrorGuide(status, code)?.description ?? GENERIC_ERROR_MESSAGE);
    else toast.error(GENERIC_ERROR_MESSAGE);
  };

  /** 게시 해제를 취소한다. 해제 응답의 새 `version`으로 다시 게시한다(서버는 재게시와 같은 API). */
  const handleUndo = async (unpublished: ServerNotice) => {
    if (isBusy.current) return;
    isBusy.current = true;
    setIsRunning(true);
    try {
      await publishMutation.mutateAsync({
        id: unpublished.id,
        data: { version: unpublished.version },
      });
      toast.success('게시 해제를 취소했습니다.');
    } catch (error) {
      handleFailure(error);
    } finally {
      isBusy.current = false;
      setIsRunning(false);
    }
  };

  const handleAction = async () => {
    if (isBusy.current) return;
    isBusy.current = true;
    setIsRunning(true);
    try {
      if (action === 'delete') {
        await deleteMutation.mutateAsync({ id: notice.id });
        setIsConfirmOpen(false);
        toast.success('초안을 삭제했습니다.');
        onDeleted?.();
      } else if (action === 'unpublish') {
        const unpublished = await unpublishMutation.mutateAsync({
          id: notice.id,
        });
        toast.success('게시를 해제했습니다.', {
          duration: 8000,
          action: {
            label: '실행 취소',
            onClick: () => void handleUndo(unpublished),
          },
        });
      } else if (version !== undefined) {
        await publishMutation.mutateAsync({ id: notice.id, data: { version } });
        setIsConfirmOpen(false);
        toast.success('공지를 다시 게시했습니다.');
      }
    } catch (error) {
      handleFailure(error);
    } finally {
      isBusy.current = false;
      setIsRunning(false);
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
        {isRunning ? `${label} 중…` : label}
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
