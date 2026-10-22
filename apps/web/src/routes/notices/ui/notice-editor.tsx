import axios from 'axios';
import { useIsMutating } from '@tanstack/react-query';
import { useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useLeaveGuard } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/atoms/card';
import { Input } from '@/ui/atoms/input';
import { Textarea } from '@/ui/atoms/textarea';
import { Label } from '@/ui/atoms/label';
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
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { useChangeNotice } from '../api/notices/index';
import type { Notice } from '../type/notice';
import { createNoticeBody, getNoticeText, validateNotice } from '../util/notice-policy';
import { useNoticeListSearchParams } from '../util/list-search-params';
import { NoticeActions } from './notice-actions';
import { NoticeBreadcrumb } from './notice-breadcrumb';
import { NoticeStatusBadge } from './notice-status-badge';

export function NoticeEditor({ notice, onPublished }: { notice?: Notice; onPublished: (notice: Notice) => void }) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const mutation = useChangeNotice(email);
  const isPending = useIsMutating({ mutationKey: ['notices', email, 'change'] }) > 0;
  const navigate = useNavigate();
  const { listSearch } = useNoticeListSearchParams();
  const [savedNotice, setSavedNotice] = useState(notice);
  const [previewDate] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState(notice?.title ?? '');
  const [text, setText] = useState(notice ? getNoticeText(notice.body) : '');
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('write');
  const [saveError, setSaveError] = useState<{ title: string; description: string; isMissing: boolean } | null>(null);
  const isBusy = useRef(false);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const input = { title, body: createNoticeBody(text) };
  const validation = validateNotice(input);
  const hasChanged =
    title !== (savedNotice?.title ?? '') || text !== (savedNotice ? getNoticeText(savedNotice.body) : '');
  const isDirty = hasChanged && !isDiscarded;
  const isDraft = !savedNotice || savedNotice.status === 'draft';
  const pageTitle = isDraft ? (savedNotice ? '초안 수정' : '새 공지 작성') : '공지 수정';
  useLeaveGuard({ isDirty, description: '저장하지 않은 공지 내용이 사라집니다.', discard: () => setIsDiscarded(true) });

  const leaveAfterSuccess = (action: () => void) => {
    flushSync(() => setIsDiscarded(true));
    action();
  };

  const handleSave = async (action: 'save' | 'publish') => {
    if (isBusy.current || !validation.canSave || (action === 'publish' && !validation.canPublish)) return;
    isBusy.current = true;
    setSaveError(null);
    try {
      const updated = await mutation.mutateAsync({
        id: savedNotice?.id,
        revision: savedNotice?.revision,
        action,
        input,
      });
      if (!updated) return;
      flushSync(() => setSavedNotice(updated));
      setIsPublishOpen(false);
      if (action === 'publish') leaveAfterSuccess(() => onPublished(updated));
      else if (isDraft) {
        toast.success('초안을 저장했습니다.');
        if (!savedNotice) {
          leaveAfterSuccess(
            () =>
              void navigate({ pathname: `${PAGES.notices.path}/${updated.id}`, search: listSearch }, { replace: true })
          );
        }
      } else {
        toast.success('변경 내용을 저장했습니다.');
        leaveAfterSuccess(
          () =>
            void navigate({ pathname: `${PAGES.notices.path}/${updated.id}`, search: listSearch }, { replace: true })
        );
      }
    } catch (error) {
      setIsPublishOpen(false);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 409 || status === 404) {
        setSaveError({
          title: action === 'publish' ? '공지를 게시하지 못했습니다.' : '저장하지 못했습니다.',
          description:
            status === 404
              ? '다른 팀원이 삭제한 초안입니다. 입력한 내용이 필요하면 복사해 둔 뒤 목록으로 이동해 주세요.'
              : '다른 팀원이 먼저 저장한 내용이 있습니다. 입력한 내용을 복사해 둔 뒤 새로고침해 최신 내용을 불러와 주세요.',
          isMissing: status === 404,
        });
      } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      isBusy.current = false;
    }
  };

  const handleCancelEdit = () =>
    void navigate({ pathname: `${PAGES.notices.path}/${savedNotice!.id}`, search: listSearch });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab =
      event.key === 'Home' ? 'write' : event.key === 'End' ? 'preview' : activeTab === 'write' ? 'preview' : 'write';
    setActiveTab(nextTab);
    document.getElementById(`notice-${nextTab}-tab`)?.focus();
  };
  const titleError =
    validation.titleCount > 50
      ? `제목은 50자까지 입력할 수 있습니다. ${validation.titleCount - 50}자를 줄여 주세요.`
      : '';
  const bodyError =
    validation.bodyCount > 5000
      ? `본문은 5,000자까지 입력할 수 있습니다. ${(validation.bodyCount - 5000).toLocaleString()}자를 줄여 주세요.`
      : '';

  return (
    <>
      <title>{formatDocumentTitle(pageTitle)}</title>
      <NoticeBreadcrumb title={pageTitle} listSearch={listSearch} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-kd-title-1'>{pageTitle}</h1>
        <div className='flex flex-wrap gap-2'>
          {isDraft ? (
            <>
              {savedNotice && (
                <NoticeActions
                  notice={savedNotice}
                  title={title}
                  onDeleted={() =>
                    leaveAfterSuccess(() => void navigate({ pathname: PAGES.notices.path, search: listSearch }))
                  }
                />
              )}
              <Button
                variant='outline'
                disabled={isPending || !validation.canSave || (!!savedNotice && !hasChanged)}
                onClick={() => void handleSave('save')}
              >
                초안 저장
              </Button>
              <Button
                ref={publishButtonRef}
                disabled={isPending || !validation.canPublish}
                onClick={() => setIsPublishOpen(true)}
              >
                공지 게시
              </Button>
            </>
          ) : (
            <>
              <Button variant='outline' disabled={isPending} onClick={handleCancelEdit}>
                수정 취소
              </Button>
              <Button
                disabled={isPending || !hasChanged || !validation.canPublish}
                onClick={() => void handleSave('save')}
              >
                변경 저장
              </Button>
            </>
          )}
        </div>
      </div>
      {saveError && (
        <div
          role='alert'
          className='mt-6 rounded-kd-3 border border-kd-error-border bg-kd-error-background p-4 text-kd-body text-kd-error-foreground'
        >
          <p className='font-bold'>{saveError.title}</p>
          <p>{saveError.description}</p>
          {saveError.isMissing && (
            <Button variant='link' onClick={() => void navigate({ pathname: PAGES.notices.path, search: listSearch })}>
              목록으로
            </Button>
          )}
        </div>
      )}
      {(titleError || bodyError) && (
        <div
          role='alert'
          className='mt-6 rounded-kd-3 border border-kd-error-border bg-kd-error-background p-4 text-kd-body text-kd-error-foreground'
        >
          <p className='font-bold'>입력 내용을 확인해 주세요.</p>
          {titleError && (
            <button
              className='block text-left underline'
              onClick={() => document.getElementById('notice-title')?.focus()}
            >
              {titleError}
            </button>
          )}
          {bodyError && (
            <button
              className='block text-left underline'
              onClick={() => document.getElementById('notice-body')?.focus()}
            >
              {bodyError}
            </button>
          )}
        </div>
      )}
      <div className='mt-6 flex flex-wrap items-center gap-3 text-kd-sub text-kd-foreground-muted' aria-live='polite'>
        <NoticeStatusBadge status={savedNotice?.status ?? 'draft'} />
        <span>{savedNotice ? formatDate(savedNotice.updatedAt, true) : '저장 전'}</span>
        {hasChanged && <span className='text-kd-warning-foreground'>저장하지 않은 변경</span>}
        {isPending && <span role='status'>처리 중…</span>}
        <span className='ml-auto'>* {isDraft ? '게시할 때 필수' : '필수 입력'}</span>
      </div>
      <div
        role='tablist'
        aria-label='공지 작성 보기'
        onKeyDown={handleTabKeyDown}
        className='mt-4 flex gap-2 min-[1200px]:hidden'
      >
        <Button
          id='notice-write-tab'
          role='tab'
          aria-selected={activeTab === 'write'}
          tabIndex={activeTab === 'write' ? 0 : -1}
          aria-controls='notice-write-panel'
          variant={activeTab === 'write' ? 'default' : 'outline'}
          onClick={() => setActiveTab('write')}
        >
          작성
        </Button>
        <Button
          id='notice-preview-tab'
          role='tab'
          aria-selected={activeTab === 'preview'}
          tabIndex={activeTab === 'preview' ? 0 : -1}
          aria-controls='notice-preview-panel'
          variant={activeTab === 'preview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('preview')}
        >
          미리보기
        </Button>
      </div>
      <div className='mt-4 grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 max-[1200px]:grid-cols-1'>
        <Card
          id='notice-write-panel'
          role='tabpanel'
          aria-labelledby='notice-write-tab'
          className={activeTab !== 'write' ? 'max-[1200px]:hidden' : ''}
        >
          <CardContent className='space-y-6 pt-6'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='notice-title'>제목 *</Label>
                <span className='text-kd-caption text-kd-foreground-muted'>{validation.titleCount} / 50</span>
              </div>
              <Input
                id='notice-title'
                placeholder='공지 제목을 입력해 주세요'
                value={title}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'notice-title-error' : undefined}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isPending}
              />
              {titleError && (
                <p id='notice-title-error' className='text-kd-caption text-kd-error-foreground'>
                  {titleError}
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='notice-body'>본문 *</Label>
                <span className='text-kd-caption text-kd-foreground-muted'>
                  {validation.bodyCount.toLocaleString()} / 5,000
                </span>
              </div>
              <Textarea
                id='notice-body'
                className='min-h-96 resize-y'
                placeholder='앱에 표시할 공지 내용을 입력해 주세요'
                value={text}
                aria-invalid={!!bodyError}
                aria-describedby={bodyError ? 'notice-body-error' : undefined}
                onChange={(event) => setText(event.target.value)}
                disabled={isPending}
              />
              {bodyError && (
                <p id='notice-body-error' className='text-kd-caption text-kd-error-foreground'>
                  {bodyError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <aside
          id='notice-preview-panel'
          role='tabpanel'
          aria-label='앱 공지 미리보기'
          className={`sticky top-6 mx-auto w-full max-w-[360px] ${activeTab !== 'preview' ? 'max-[1200px]:hidden' : ''}`}
        >
          <p className='mb-3 text-kd-sub font-semibold text-kd-foreground-muted'>앱 미리보기</p>
          <div className='overflow-hidden rounded-[32px] border-4 border-kd-neutral-200 bg-kd-background shadow-kd-float'>
            <div className='mx-auto mt-3 h-1.5 w-16 rounded-full bg-kd-neutral-200' />
            <div className='border-b border-kd-border px-5 py-4 text-center text-kd-body font-bold'>공지사항</div>
            <div className='max-h-[65vh] min-h-96 overflow-y-auto p-5 [overflow-wrap:anywhere]'>
              <h2 className='text-kd-title-2'>{title || '공지 제목'}</h2>
              <p className='mt-2 text-kd-caption text-kd-foreground-muted'>
                {savedNotice?.publishedAt ? formatDate(savedNotice.publishedAt) : formatDate(previewDate)}
              </p>
              <p className='mt-6 whitespace-pre-wrap text-kd-body'>{text || '공지 내용을 입력해 주세요.'}</p>
            </div>
          </div>
        </aside>
      </div>
      <AlertDialog open={isPublishOpen} onOpenChange={(open) => !isPending && setIsPublishOpen(open)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            publishButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>공지를 게시할까요?</AlertDialogTitle>
            <AlertDialogDescription className='[overflow-wrap:anywhere]'>제목: {title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleSave('publish');
              }}
            >
              공지 게시
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NoticePublished({ notice, onView }: { notice: Notice; onView: () => void }) {
  const navigate = useNavigate();
  const { listSearch } = useNoticeListSearchParams();
  return (
    <>
      <title>{formatDocumentTitle('공지 게시 완료')}</title>
      <Card>
        <CardHeader className='pt-16 text-center'>
          <CardTitle>공지를 게시했습니다.</CardTitle>
        </CardHeader>
        <CardContent className='pb-16 text-center'>
          <p className='text-kd-body text-kd-foreground-muted'>{formatDate(notice.publishedAt)}</p>
          <div className='mt-6 flex justify-center gap-2'>
            <Button
              variant='outline'
              onClick={() => void navigate({ pathname: PAGES.notices.path, search: listSearch })}
            >
              목록으로
            </Button>
            <Button onClick={onView}>공지 보기</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
