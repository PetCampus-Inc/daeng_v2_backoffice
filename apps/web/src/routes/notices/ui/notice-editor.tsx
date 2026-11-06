import { useIsMutating } from '@tanstack/react-query';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useLeaveGuard } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/atoms/card';
import { Input } from '@/ui/atoms/input';
import { RichContentEditor } from '@/ui/organisms/rich-content-editor';
import { RichContentViewer } from '@/ui/organisms/rich-content-viewer';
import { RichContentImageSourcesContext } from '@/ui/organisms/rich-content-viewer/util';
import { fromContentBody, getImageUrlsById, sameRichContent } from '@/util/rich-content';
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
import { formatDate, formatTime } from '@/util/date-format';
import { useAutoSave } from '@/util/use-auto-save';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { getNoticeChangeMutationKey, toNotice, useNoticeChangeOptions } from '../api/notice-query';
import { useNoticeImageUpload } from '../api/notice-image-upload';
import { useCreateNotice, usePublishNotice, useUpdateNotice } from '../api/use-notices';
import type { Notice as ServerNotice } from '../type';
import type { Notice, NoticeInput } from '../type/notice-ui';
import { getNoticeErrorGuide, readNoticeError } from '../util/notice-error';
import {
  confirmNoticeImages,
  createNoticeBody,
  getNoticeText,
  NOTICE_IMAGE_ACCEPT,
  validateNotice,
} from '../util/notice-policy';
import { useNoticeListSearchParams } from '../util/list-search-params';
import { NoticeActions } from './notice-actions';
import { NoticeBreadcrumb } from './notice-breadcrumb';
import { NoticeStatusBadge } from './notice-status-badge';

export function NoticeEditor({ notice, onPublished }: { notice?: Notice; onPublished: (notice: Notice) => void }) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const changeOptions = useNoticeChangeOptions(email);
  const createMutation = useCreateNotice(changeOptions);
  const updateMutation = useUpdateNotice(changeOptions);
  const publishMutation = usePublishNotice(changeOptions);
  // 저장과 게시는 이어서 부르므로, 두 요청 사이에도 처리 중으로 본다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMutating = useIsMutating({ mutationKey: getNoticeChangeMutationKey(email) }) > 0;
  const isPending = isSubmitting || isMutating;
  const navigate = useNavigate();
  const { listSearch } = useNoticeListSearchParams();
  const [savedNotice, setSavedNotice] = useState(notice);
  const [previewDate] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(() => notice?.body ?? createNoticeBody(''));
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('write');
  const imageUpload = useNoticeImageUpload(savedNotice?.id);
  const isImageUploading = imageUpload.isUploading;
  // 저장으로 확정된 이미지(tempKey → imageId)와 저장된 이미지의 보기 주소. 저장 본문에는 주소를 넣지 않으므로 화면이 따로 쥔다.
  const [confirmedImages, setConfirmedImages] = useState<Record<string, number>>({});
  const [savedImageUrls, setSavedImageUrls] = useState(() => getImageUrlsById(notice?.previewBody ?? body));
  const [saveError, setSaveError] = useState<{ title: string; description: string; isMissing: boolean } | null>(null);
  const isBusy = useRef(false);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const input = { title, body };
  const validation = validateNotice(input);
  const hasChanged =
    title !== (savedNotice?.title ?? '') || !sameRichContent(body, savedNotice?.body ?? createNoticeBody(''));
  const isDirty = hasChanged && !isDiscarded;
  const isDraft = !savedNotice || savedNotice.status === 'draft';
  const pageTitle = isDraft ? (savedNotice ? '초안 수정' : '새 공지 작성') : '공지 수정';
  useLeaveGuard({
    isDirty: isDirty || (isImageUploading && !isDiscarded),
    description: '저장하지 않은 공지 내용이 사라집니다.',
    discard: () => setIsDiscarded(true),
  });

  const leaveAfterSuccess = (action: () => void) => {
    flushSync(() => setIsDiscarded(true));
    action();
  };

  /**
   * 저장 응답을 화면 상태로 바꾼다. 방금 저장한 제목·본문을 기준으로 삼아, 저장 직후에는 변경 없음으로 본다.
   * 서버가 확정한 새 이미지는 본문의 `tempKey`를 `imageId`로 바꾸고(편집기에도 알린다), 이미지 보기 주소를 응답에서 받는다.
   */
  const toSavedNotice = (response: ServerNotice, saved: NoticeInput): Notice => {
    const next = toNotice(response);
    const { body: confirmedBody, confirmed } = confirmNoticeImages(saved.body, fromContentBody(response.body));
    if (Object.keys(confirmed).length > 0) setConfirmedImages((prev) => ({ ...prev, ...confirmed }));
    setSavedImageUrls((prev) => ({ ...prev, ...getImageUrlsById(next.previewBody) }));
    return { ...next, title: saved.title, body: confirmedBody };
  };

  /** 초안이 없으면 새로 만들고, 있으면 그 공지를 저장한다(서버 저장은 상태를 바꾸지 않는다). */
  const saveNotice = async (target: Notice | undefined) => {
    const data = { title: input.title, body: input.body };
    const response = target
      ? await updateMutation.mutateAsync({ id: target.id, data: { ...data, version: target.version } })
      : await createMutation.mutateAsync({ data });
    return toSavedNotice(response, input);
  };

  /**
   * 저장하거나 게시한다. 게시는 저장(바뀐 내용이 있거나 아직 저장 전일 때) → 게시를 이어서 부른다.
   * 저장은 됐는데 게시만 실패하면 저장된 초안(새 번호·version)을 화면 상태로 삼아, 다시 눌러도 새 초안을 만들지 않는다.
   */
  const handleSave = async (action: 'save' | 'publish') => {
    const isBlocked = isBusy.current || isImageUploading || !validation.canSave;
    if (isBlocked || (action === 'publish' && !validation.canPublish)) return;
    isBusy.current = true;
    setIsSubmitting(true);
    setSaveError(null);
    let target = savedNotice;
    let isSavedNow = false;
    try {
      if (action === 'save' || !target || hasChanged) {
        target = await saveNotice(target);
        isSavedNow = true;
        flushSync(() => setSavedNotice(target));
      }
      if (action === 'publish') {
        try {
          const response = await publishMutation.mutateAsync({ id: target!.id, data: { version: target!.version } });
          const published = toSavedNotice(response, input);
          flushSync(() => setSavedNotice(published));
          setIsPublishOpen(false);
          leaveAfterSuccess(() => onPublished(published));
        } catch (error) {
          if (!isSavedNow) throw error;
          setIsPublishOpen(false);
          toast.error('임시저장은 됐지만 게시하지 못했어요. 다시 게시해 주세요.');
        }
        return;
      }
      if (isDraft) {
        toast.success('초안을 저장했습니다.');
        if (!savedNotice) {
          leaveAfterSuccess(
            () =>
              void navigate({ pathname: `${PAGES.notices.path}/${target!.id}`, search: listSearch }, { replace: true })
          );
        }
      } else {
        toast.success('변경 내용을 저장했습니다.');
        leaveAfterSuccess(
          () =>
            void navigate({ pathname: `${PAGES.notices.path}/${target!.id}`, search: listSearch }, { replace: true })
        );
      }
    } catch (error) {
      setIsPublishOpen(false);
      const { status, code } = readNoticeError(error);
      const guide = getNoticeErrorGuide(status, code);
      if (guide) {
        setSaveError({
          title: action === 'publish' ? '공지를 게시하지 못했습니다.' : '저장하지 못했습니다.',
          description: guide.description,
          isMissing: guide.isMissing,
        });
      } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      isBusy.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * 작성 중 자동 임시저장. 기존 저장 함수(`saveNotice`)를 그대로 쓰되 토스트·이동·오류 박스는 쓰지 않는다.
   * 처음 한 번만 만들고 이후에는 받은 번호·version으로 같은 초안을 저장한다.
   */
  const autoSaveNotice = async () => {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      const saved = await saveNotice(savedNotice);
      flushSync(() => setSavedNotice(saved));
    } finally {
      isBusy.current = false;
    }
  };
  const contentKey = useMemo(() => ({ title, body }), [title, body]);
  const autoSave = useAutoSave({
    // 게시된 글·게시 해제된 글은 저장이 앱에 바로 반영되므로 새 글과 초안 수정에서만 쓴다.
    enabled: isDraft && !isDiscarded,
    hasChanged,
    canSave:
      validation.canSave &&
      (title.trim().length > 0 || getNoticeText(body).trim().length > 0) &&
      !isSubmitting &&
      !isMutating &&
      !isImageUploading &&
      !isPublishOpen,
    contentKey,
    save: autoSaveNotice,
    isPermanentError: (error) => {
      const { status, code } = readNoticeError(error);
      return !!getNoticeErrorGuide(status, code);
    },
  });
  const isAutoSaving = autoSave.status === 'saving';
  const { previewUrls } = imageUpload;
  // 방금 올린 이미지는 내 컴퓨터 파일로 보여 주고(저장 뒤에도 같은 파일), 저장된 이미지는 응답의 보기 주소로 보여 준다.
  const imageSources = useMemo(() => {
    const byImageId = { ...savedImageUrls };
    for (const [tempKey, imageId] of Object.entries(confirmedImages)) {
      if (previewUrls[tempKey]) byImageId[imageId] = previewUrls[tempKey];
    }
    return { byTempKey: previewUrls, byImageId };
  }, [savedImageUrls, confirmedImages, previewUrls]);

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
    <RichContentImageSourcesContext.Provider value={imageSources}>
      <title>{formatDocumentTitle(pageTitle)}</title>
      <NoticeBreadcrumb title={pageTitle} listSearch={listSearch} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-kd-title-1'>{pageTitle}</h1>
        <div className='flex flex-wrap gap-2'>
          {autoSave.status === 'saved' && (
            <span role='status' className='self-center text-kd-caption text-kd-foreground-muted'>
              임시저장됨 {formatTime(autoSave.savedAt)}
            </span>
          )}
          {autoSave.status === 'failed' && hasChanged && (
            <span role='status' className='self-center text-kd-caption text-kd-error-foreground'>
              임시저장하지 못했습니다.
            </span>
          )}
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
                disabled={isPending || isImageUploading || !validation.canSave || (!!savedNotice && !hasChanged)}
                onClick={() => void handleSave('save')}
              >
                초안 저장
              </Button>
              <Button
                ref={publishButtonRef}
                disabled={isPending || isImageUploading || !validation.canPublish}
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
                disabled={isPending || isImageUploading || !hasChanged || !validation.canPublish}
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
        {isPending && !isAutoSaving && <span role='status'>처리 중…</span>}
        {isImageUploading && <span role='status'>이미지를 올리는 중…</span>}
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
                disabled={isPending && !isAutoSaving}
              />
              {titleError && (
                <p id='notice-title-error' className='text-kd-caption text-kd-error-foreground'>
                  {titleError}
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='notice-body' onClick={() => document.getElementById('notice-body')?.focus()}>
                  본문 *
                </Label>
                <span className='text-kd-caption text-kd-foreground-muted'>
                  {validation.bodyCount.toLocaleString()} / 5,000
                </span>
              </div>
              <RichContentEditor
                id='notice-body'
                placeholder='앱에 표시할 공지 내용을 입력해 주세요'
                value={body}
                aria-invalid={!!bodyError}
                aria-describedby={bodyError ? 'notice-body-error' : undefined}
                onChange={setBody}
                readOnly={isPending && !isAutoSaving}
                imageUpload={{
                  accept: NOTICE_IMAGE_ACCEPT,
                  isUploading: isImageUploading,
                  upload: imageUpload.upload,
                  confirmed: confirmedImages,
                }}
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
          className={`mx-auto flex w-full max-w-[360px] flex-col self-stretch min-[1200px]:h-0 min-[1200px]:min-h-full ${activeTab !== 'preview' ? 'max-[1200px]:hidden' : ''}`}
        >
          <p className='mb-3 text-kd-sub font-semibold text-kd-foreground-muted'>앱 미리보기</p>
          <div className='flex min-h-0 flex-col overflow-hidden rounded-[32px] border-4 border-kd-neutral-200 bg-kd-background shadow-kd-float min-[1200px]:flex-1'>
            <div className='mx-auto mt-3 h-1.5 w-16 shrink-0 rounded-full bg-kd-neutral-200' />
            <div className='shrink-0 border-b border-kd-border px-5 py-4 text-center text-kd-body font-bold'>
              공지사항
            </div>
            <div className='h-[32rem] overflow-y-auto p-5 [overflow-wrap:anywhere] min-[1200px]:h-auto min-[1200px]:min-h-0 min-[1200px]:flex-1'>
              <h2 className='text-kd-title-2'>{title || '공지 제목'}</h2>
              <p className='mt-2 text-kd-caption text-kd-foreground-muted'>
                {savedNotice?.publishedAt ? formatDate(savedNotice.publishedAt) : formatDate(previewDate)}
              </p>
              <RichContentViewer value={body} className='mt-6' />
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
    </RichContentImageSourcesContext.Provider>
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
