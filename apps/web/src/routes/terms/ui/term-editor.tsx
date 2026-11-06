import { memo, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { Tabs } from 'radix-ui';
import { useIsMutating } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useLeaveGuard } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent } from '@/ui/atoms/card';
import { Input } from '@/ui/atoms/input';
import { RichContentEditor } from '@/ui/organisms/rich-content-editor';
import { RichContentViewer } from '@/ui/organisms/rich-content-viewer';
import type { RichContent } from '@/type/rich-content';
import { getRichText, sameRichContent } from '@/util/rich-content';
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
import { formatDocumentTitle } from '@/util/page-config';
import {
  getTermChangeMutationKey,
  toServerTermKind,
  toTerm,
  toTermCreateRequest,
  toTermUpdateRequest,
  useTermChangeOptions,
} from '../api/term-query';
import type { TermsVersion as ServerTerm } from '../type';
import { useCreateTermsVersion, usePublishTermsVersion, useUpdateTermsVersion } from '../api/use-terms';
import { TERM_KIND_LABELS, type Term, type TermKind, type TermSummary } from '../type/term-ui';
import { getTermErrorGuide, readTermError } from '../util/term-error';
import {
  countTermBody,
  displayTermDate,
  findSplitTermPlaceholders,
  getInitialTermBody,
  getSplitPlaceholderMessage,
  getTermBodyOverMessage,
  parseTermDate,
  readTermDateInput,
  TERM_DATE_FORMAT_MESSAGE,
  TERM_BODY_MAX_LENGTH,
  TERM_DATE_REQUIRED_MESSAGE,
  validateEffectiveDate,
} from '../util/term-policy';
import { termListPath, termPath } from '../util/term-navigation';
import { TermBreadcrumb, TermStatusBadge } from '../ui/term-common';
import { TermConfirm } from './term-confirm';

/**
 * 탭 전환처럼 본문과 상관없는 다시 그리기에는 편집기를 다시 그리지 않는다.
 * 편집기는 다시 그릴 때 자기가 아는 선택 위치를 화면에 덮어쓰는데, 방금 바꾼 선택이 아직 편집기에 전해지기 전이면 선택이 글 끝으로 돌아간다.
 */
const BodyEditor = memo(RichContentEditor);

const SAVE_ERROR_TITLE = '저장하지 못했습니다.';
const PUBLISH_ERROR_TITLE = '약관을 공개하지 못했습니다.';

/**
 * 새 버전 작성·초안 수정 화면. 서버는 저장(초안)과 공개가 따로라서 공개는 저장 → 공개를 이어서 부른다.
 * 저장은 됐는데 공개만 실패하면 저장된 초안(새 번호·`revision`)을 화면 상태로 삼아, 다시 눌러도 새 초안을 만들지 않는다.
 * 새 버전의 처음 본문(`startBody`)은 호출한 쪽이 가져온다.
 */
export function TermEditor({
  kind,
  term,
  versions,
  startBody,
}: {
  kind: TermKind;
  term?: Term;
  versions: TermSummary[];
  startBody?: RichContent;
}) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const changeOptions = useTermChangeOptions(email);
  const createMutation = useCreateTermsVersion(changeOptions);
  const updateMutation = useUpdateTermsVersion(changeOptions);
  const publishMutation = usePublishTermsVersion(changeOptions);
  // 저장과 공개는 이어서 부르므로, 두 요청 사이에도 처리 중으로 본다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMutating = useIsMutating({ mutationKey: getTermChangeMutationKey(email) }) > 0;
  const isPending = isSubmitting || isMutating;
  const navigate = useNavigate();
  const [initialBody] = useState(() => term?.body ?? startBody ?? getInitialTermBody([]));
  const [saved, setSaved] = useState(term);
  const [date, setDate] = useState(term?.effectiveDate ? displayTermDate(term.effectiveDate) : '');
  const [body, setBody] = useState(initialBody);
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('write');
  const [error, setError] = useState<{
    title: string;
    description: string;
    missing?: boolean;
    field?: 'date' | 'body';
  } | null>(null);
  const busy = useRef(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLButtonElement>(null);
  const { count: bodyCount, isOverLimit: isBodyOver } = countTermBody(body);
  const bodyOverMessage = isBodyOver ? getTermBodyOverMessage(bodyCount) : '';
  const hasChanged =
    !sameRichContent(body, saved?.body ?? initialBody) ||
    date !== (saved?.effectiveDate ? displayTermDate(saved.effectiveDate) : '');
  const title = `${TERM_KIND_LABELS[kind]} ${saved ? `버전 #${saved.version} 초안 수정` : '새 버전'}`;
  useLeaveGuard({
    isDirty: hasChanged && !isDiscarded,
    description: '저장하지 않은 약관 내용이 사라집니다.',
    discard: () => setIsDiscarded(true),
  });
  const leave = (action: () => void) => {
    flushSync(() => setIsDiscarded(true));
    action();
  };
  const showFieldError = (title: string, description: string, field: 'date' | 'body' = 'date') => {
    flushSync(() => setError({ title, description, field }));
    (field === 'date' ? dateRef.current : bodyRef.current)?.focus();
  };
  const showPublishError = (description: string, field: 'date' | 'body' = 'date') =>
    showFieldError(PUBLISH_ERROR_TITLE, description, field);
  const preparePublish = () => {
    const validation = validateEffectiveDate(date, versions);
    if (validation) {
      showPublishError(validation);
      return;
    }
    if (!getRichText(body).trim()) {
      showPublishError('본문을 입력해 주세요.', 'body');
      return;
    }
    // 서식으로 쪼개진 {{공고일}}·{{시행일}}은 서버가 못 채워 그대로 공개되고, 공개 뒤에는 고칠 수 없어 서버 요청 전에 막는다.
    const splits = findSplitTermPlaceholders(body);
    if (splits.length > 0) {
      showPublishError(getSplitPlaceholderMessage(splits), 'body');
      return;
    }
    setError(null);
    setPublishOpen(true);
  };
  /** 저장 응답을 화면 상태로 바꾼다. 방금 저장한 본문을 기준으로 삼아, 저장 직후에는 변경 없음으로 본다. */
  const toSavedTerm = (response: ServerTerm): Term => ({ ...toTerm(response), body });

  /** 초안이 없으면 새로 만들고, 있으면 그 초안을 수정한다(서버 저장은 항상 초안). 시행일이 `null`이면 비운 채 저장한다. */
  const saveTerm = async (target: Term | undefined, effectiveDate: string | null) => {
    // 화면의 버전 번호(`version`)가 서버 `id`, 동시 수정 값(`revision`)이 서버 `version`이다.
    const response = target
      ? await updateMutation.mutateAsync({
          id: target.version,
          data: { ...toTermUpdateRequest(effectiveDate, body), version: target.revision },
        })
      : await createMutation.mutateAsync({
          kind: toServerTermKind(kind),
          data: toTermCreateRequest(effectiveDate, body),
        });
    return toSavedTerm(response);
  };

  const handleSave = async (action: 'save' | 'publish') => {
    if (busy.current || isPending) return;
    const errorTitle = action === 'publish' ? PUBLISH_ERROR_TITLE : SAVE_ERROR_TITLE;
    // 시행일은 초안 저장에서는 비워 둘 수 있고(null), 적었다면 형식이 맞아야 한다. 공개할 때는 반드시 있어야 한다.
    const effectiveDate = readTermDateInput(date);
    if (effectiveDate === undefined || (action === 'publish' && !effectiveDate)) {
      setPublishOpen(false);
      showFieldError(errorTitle, effectiveDate === undefined ? TERM_DATE_FORMAT_MESSAGE : TERM_DATE_REQUIRED_MESSAGE);
      return;
    }
    busy.current = true;
    setIsSubmitting(true);
    setError(null);
    let target = saved;
    let isSavedNow = false;
    try {
      if (action === 'save' || !target || hasChanged) {
        target = await saveTerm(target, effectiveDate);
        isSavedNow = true;
        const savedTerm = target;
        flushSync(() => {
          setSaved(savedTerm);
          setDate(displayTermDate(savedTerm.effectiveDate));
        });
      }
      if (action === 'publish') {
        try {
          const response = await publishMutation.mutateAsync({
            id: target!.version,
            data: { version: target!.revision },
          });
          const published = toTerm(response);
          setPublishOpen(false);
          toast.success(`약관을 공개했습니다. 시행일 ${displayTermDate(published.effectiveDate)}부터 적용됩니다.`);
          leave(() => void navigate(termListPath(kind)));
        } catch (publishError) {
          if (!isSavedNow) throw publishError;
          setPublishOpen(false);
          toast.error('임시저장은 됐지만 공개하지 못했어요. 다시 공개해 주세요.');
        }
        return;
      }
      toast.success('초안을 저장했습니다.');
      if (!saved) leave(() => void navigate(termPath(kind, target!.version), { replace: true }));
    } catch (caught) {
      setPublishOpen(false);
      const { status, code } = readTermError(caught);
      const guide = getTermErrorGuide(status, code);
      if (guide?.field) showFieldError(errorTitle, guide.description, guide.field);
      else if (guide) setError({ title: errorTitle, description: guide.description, missing: guide.isMissing });
      else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  };
  /**
   * 작성 중 자동 임시저장. 기존 저장 함수(`saveTerm`)를 그대로 쓰되 토스트·이동·오류 박스는 쓰지 않는다.
   * 처음 한 번만 만들고 이후에는 받은 번호·`revision`으로 같은 초안을 저장한다. 시행일이 비어 있거나 형식이 맞을 때만 부른다.
   */
  const autoSaveTerm = async () => {
    const effectiveDate = readTermDateInput(date);
    if (busy.current || effectiveDate === undefined) return;
    busy.current = true;
    try {
      const savedTerm = await saveTerm(saved, effectiveDate);
      const typedDate = date;
      // 저장하는 사이 시행일을 더 고쳤다면 사용자가 쓴 값을 덮어쓰지 않는다.
      flushSync(() => {
        setSaved(savedTerm);
        setDate((current) => (current === typedDate ? displayTermDate(savedTerm.effectiveDate) : current));
      });
    } finally {
      busy.current = false;
    }
  };
  const contentKey = useMemo(() => ({ date, body }), [date, body]);
  const autoSave = useAutoSave({
    // 이 화면은 초안만 다루고, 공개 성공 뒤에는 화면을 떠나므로(`isDiscarded`) 그때부터 멈춘다.
    enabled: !isDiscarded,
    hasChanged,
    canSave: readTermDateInput(date) !== undefined && !isBodyOver && !isSubmitting && !isMutating && !publishOpen,
    contentKey,
    save: autoSaveTerm,
    isPermanentError: (caught) => {
      const { status, code } = readTermError(caught);
      return !!getTermErrorGuide(status, code);
    },
  });
  const isAutoSaving = autoSave.status === 'saving';
  return (
    <>
      <title>{formatDocumentTitle(title)}</title>
      <TermBreadcrumb title={title} kind={kind} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 tabIndex={-1} className='min-w-0 text-kd-title-1 [overflow-wrap:anywhere]'>
          {title}
        </h1>
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
          {saved && (
            <TermConfirm
              term={saved}
              action='delete'
              onFailed={(status, code) => {
                const guide = status === 404 || status === 409 ? getTermErrorGuide(status, code) : null;
                if (guide) {
                  setError({ title: '삭제하지 못했습니다.', description: guide.description, missing: guide.isMissing });
                } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
              }}
              onDeleted={() => leave(() => void navigate(termListPath(kind)))}
            />
          )}
          <Button
            variant='outline'
            disabled={isPending || isBodyOver || (!!saved && !hasChanged)}
            onClick={() => void handleSave('save')}
          >
            초안 저장
          </Button>
          <Button ref={publishRef} disabled={isPending || isBodyOver} onClick={preparePublish}>
            공개하기
          </Button>
        </div>
      </div>
      {error && (
        <div
          role='alert'
          className='mt-6 rounded-kd-3 border border-kd-error-border bg-kd-error-background p-4 text-kd-body text-kd-error-foreground'
        >
          <p className='font-bold'>{error.title}</p>
          <p id='term-error'>{error.description}</p>
          {error.missing && (
            <Button variant='link' onClick={() => void navigate(termListPath(kind))}>
              목록으로
            </Button>
          )}
        </div>
      )}
      <div className='mt-6 flex flex-wrap items-center gap-3 text-kd-sub text-kd-foreground-muted'>
        <TermStatusBadge status='초안' />
        <span>{saved ? formatDate(saved.updatedAt, true) : '저장 전'}</span>
        {hasChanged && <span>저장하지 않은 변경</span>}
        <span role='status'>{isPending && !isAutoSaving ? '처리 중… 입력은 처리 후 수정할 수 있습니다.' : ''}</span>
        <span className='ml-auto'>* 공개할 때 필수</span>
      </div>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className='mt-4 min-w-0'>
        <Tabs.List aria-label='약관 작성 보기' className='mb-4 flex gap-2 min-[1200px]:hidden'>
          {['write', 'preview'].map((value) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className='rounded-kd-2 border border-kd-border px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-kd-primary data-[state=active]:bg-kd-primary data-[state=active]:text-white'
            >
              {value === 'write' ? '작성' : '미리보기'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_360px] items-start gap-6 max-[1199px]:grid-cols-1'>
          <Tabs.Content
            forceMount
            value='write'
            className={`min-w-0 ${activeTab !== 'write' ? 'max-[1199px]:hidden' : ''}`}
          >
            <Card>
              <CardContent className='space-y-6 pt-6'>
                <div className='space-y-2'>
                  <Label htmlFor='term-date'>시행일 *</Label>
                  <Input
                    ref={dateRef}
                    id='term-date'
                    placeholder='2026. 11. 10.'
                    value={date}
                    readOnly={isPending && !isAutoSaving}
                    aria-invalid={error?.field === 'date'}
                    aria-describedby={error?.field === 'date' ? 'term-error term-date-help' : 'term-date-help'}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  <p id='term-date-help' className='text-kd-caption text-kd-foreground-muted'>
                    공개한 날로부터 7일 뒤부터 고를 수 있어요. 초안은 시행일을 비워 두고 저장할 수 있어요.
                  </p>
                  <details className='text-kd-sub'>
                    <summary className='w-fit cursor-pointer rounded-kd-2 focus-visible:outline-2 focus-visible:outline-kd-primary'>
                      시행일 규칙 전체
                    </summary>
                    <ul className='mt-2 list-disc space-y-1 pl-5 text-kd-foreground-muted'>
                      <li>과거 날짜는 지정할 수 없습니다.</li>
                      <li>공개일로부터 7일 이후 날짜를 선택해 주세요.</li>
                      <li>같은 약관의 가장 최근 공개 시행일보다 이후여야 합니다. 초안·철회 버전은 제외합니다.</li>
                      <li>
                        초안은 시행일을 비워 두고 저장할 수 있습니다. 적었다면 형식(예: 2026. 10. 20.)이 맞아야 하고,
                        과거 날짜도 저장할 수 있습니다. 공개할 때 시행일이 필수이며 위 규칙을 검증합니다.
                      </li>
                    </ul>
                  </details>
                </div>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='term-body' onClick={() => bodyRef.current?.focus()}>
                      본문 *
                    </Label>
                    <span className='text-kd-caption text-kd-foreground-muted'>
                      {bodyCount.toLocaleString()} / {TERM_BODY_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <BodyEditor
                    ref={bodyRef}
                    id='term-body'
                    value={body}
                    readOnly={isPending && !isAutoSaving}
                    aria-invalid={error?.field === 'body' || isBodyOver}
                    aria-describedby={isBodyOver ? 'term-body-help term-body-error' : 'term-body-help'}
                    onChange={setBody}
                  />
                  {isBodyOver && (
                    <p id='term-body-error' className='text-kd-caption text-kd-error-foreground'>
                      {bodyOverMessage}
                    </p>
                  )}
                  <p id='term-body-help' className='text-kd-caption text-kd-foreground-muted'>
                    {
                      '약관 이름은 앱 상단에 나오므로 본문에 쓰지 않아요. {{공고일}}·{{시행일}}은 공개할 때 자동으로 채워져요.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>
          <Tabs.Content
            forceMount
            value='preview'
            className={`min-w-0 ${activeTab !== 'preview' ? 'max-[1199px]:hidden' : ''}`}
          >
            <aside aria-label='약관 앱 미리보기' className='sticky top-6 mx-auto w-full max-w-[360px]'>
              <p className='mb-3 text-kd-sub text-kd-foreground-muted'>앱 미리보기</p>
              <div className='overflow-hidden rounded-[32px] border-4 border-kd-neutral-200 bg-kd-background shadow-kd-float'>
                <div className='border-b border-kd-border px-5 py-4 text-center font-bold'>
                  {TERM_KIND_LABELS[kind]}
                </div>
                <div className='max-h-[65vh] min-h-96 overflow-y-auto p-5 [overflow-wrap:anywhere]'>
                  <p className='text-kd-caption text-kd-foreground-muted'>
                    시행일 {parseTermDate(date) ? displayTermDate(parseTermDate(date)!) : date || '미정'}
                  </p>
                  <RichContentViewer value={body} className='mt-5' />
                </div>
              </div>
            </aside>
          </Tabs.Content>
        </div>
      </Tabs.Root>
      <AlertDialog open={publishOpen} onOpenChange={(value) => !isPending && setPublishOpen(value)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target =
              error?.field === 'date'
                ? dateRef.current
                : error?.field === 'body'
                  ? bodyRef.current
                  : publishRef.current;
            target?.focus({ preventScroll: true });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>약관을 공개할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              시행일 {displayTermDate(parseTermDate(date) ?? '')} · 공개한 버전은 수정할 수 없습니다. 시행 전에는 공개를
              철회할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isPending && <p role='status'>공개 중…</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleSave('publish');
              }}
            >
              공개하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
