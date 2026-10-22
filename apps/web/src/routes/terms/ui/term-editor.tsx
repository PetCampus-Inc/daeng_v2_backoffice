import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { Tabs } from 'radix-ui';
import { useIsMutating } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useLeaveGuard } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent } from '@/ui/atoms/card';
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
import { formatDocumentTitle } from '@/util/page-config';
import { useChangeTerm } from '../api/terms';
import { TERM_KIND_LABELS, type Term, type TermKind } from '../type/term';
import { displayTermDate, getInitialTermBody, parseTermDate, validateEffectiveDate } from '../util/term-policy';
import { termListPath, termPath } from '../util/term-navigation';
import { TermBreadcrumb, TermStatusBadge } from '../ui/term-common';
import { TermConfirm } from './term-confirm';

export function TermEditor({ kind, term, versions }: { kind: TermKind; term?: Term; versions: Term[] }) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const mutation = useChangeTerm(email);
  const isPending = useIsMutating({ mutationKey: ['terms', email, 'change'] }) > 0;
  const navigate = useNavigate();
  const [initialBody] = useState(() => term?.body ?? getInitialTermBody(versions));
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const publishRef = useRef<HTMLButtonElement>(null);
  const hasChanged =
    body !== (saved?.body ?? initialBody) ||
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
  const showPublishError = (description: string, field: 'date' | 'body' = 'date') => {
    flushSync(() => setError({ title: '약관을 공개하지 못했습니다.', description, field }));
    (field === 'date' ? dateRef.current : bodyRef.current)?.focus();
  };
  const preparePublish = () => {
    const validation = validateEffectiveDate(date, versions);
    if (validation) {
      showPublishError(validation);
      return;
    }
    if (!body.trim()) {
      showPublishError('본문을 입력해 주세요.', 'body');
      return;
    }
    setError(null);
    setPublishOpen(true);
  };
  const handleSave = async (action: 'save' | 'publish') => {
    if (busy.current || isPending) return;
    busy.current = true;
    setError(null);
    try {
      const updated = await mutation.mutateAsync({
        kind,
        version: saved?.version,
        revision: saved?.revision,
        action,
        input: { effectiveDate: date, body },
      });
      if (!updated) return;
      setPublishOpen(false);
      if (action === 'publish') {
        toast.success(`약관을 공개했습니다. 시행일 ${displayTermDate(updated.effectiveDate)}부터 적용됩니다.`);
        leave(() => void navigate(termListPath(kind)));
      } else {
        flushSync(() => {
          setSaved(updated);
          setDate(updated.effectiveDate ? displayTermDate(updated.effectiveDate) : '');
        });
        toast.success('초안을 저장했습니다.');
        if (!saved) leave(() => void navigate(termPath(kind, updated.version), { replace: true }));
      }
    } catch (caught) {
      setPublishOpen(false);
      const status = axios.isAxiosError(caught) ? caught.response?.status : undefined;
      if (status === 400 && axios.isAxiosError(caught)) {
        showPublishError(caught.response?.data?.errorMessage ?? '입력 내용을 확인해 주세요.');
      } else if (status === 404 || status === 409) {
        setError({
          title: action === 'publish' ? '약관을 공개하지 못했습니다.' : '저장하지 못했습니다.',
          description:
            status === 404
              ? '다른 팀원이 삭제한 초안입니다. 입력한 내용이 필요하면 복사해 둔 뒤 목록으로 이동해 주세요.'
              : '다른 팀원이 먼저 저장한 내용이 있습니다. 입력한 내용을 복사해 둔 뒤 새로고침해 최신 내용을 불러와 주세요.',
          missing: status === 404,
        });
      } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <title>{formatDocumentTitle(title)}</title>
      <TermBreadcrumb title={title} kind={kind} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 tabIndex={-1} className='min-w-0 text-kd-title-1 [overflow-wrap:anywhere]'>
          {title}
        </h1>
        <div className='flex flex-wrap gap-2'>
          {saved && (
            <TermConfirm
              term={saved}
              action='delete'
              onFailed={(status) => {
                if (status === 404 || status === 409) {
                  setError({
                    title: '삭제하지 못했습니다.',
                    description:
                      status === 404
                        ? '다른 팀원이 삭제한 초안입니다. 입력한 내용이 필요하면 복사해 둔 뒤 목록으로 이동해 주세요.'
                        : '다른 팀원이 먼저 저장한 내용이 있습니다. 입력한 내용을 복사해 둔 뒤 새로고침해 최신 내용을 불러와 주세요.',
                    missing: status === 404,
                  });
                } else toast.error('일시적 오류로 요청을 완료하지 못했습니다.');
              }}
              onDeleted={() => leave(() => void navigate(termListPath(kind)))}
            />
          )}
          <Button
            variant='outline'
            disabled={isPending || (!!saved && !hasChanged)}
            onClick={() => void handleSave('save')}
          >
            초안 저장
          </Button>
          <Button ref={publishRef} disabled={isPending} onClick={preparePublish}>
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
        <span role='status'>{isPending ? '처리 중… 입력은 처리 후 수정할 수 있습니다.' : ''}</span>
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
                    readOnly={isPending}
                    aria-invalid={error?.field === 'date'}
                    aria-describedby={error?.field === 'date' ? 'term-error term-date-help' : 'term-date-help'}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  <p id='term-date-help' className='text-kd-caption text-kd-foreground-muted'>
                    공개한 날로부터 7일 뒤부터 고를 수 있어요.
                  </p>
                  <details className='text-kd-sub'>
                    <summary className='w-fit cursor-pointer rounded-kd-2 focus-visible:outline-2 focus-visible:outline-kd-primary'>
                      시행일 규칙 전체
                    </summary>
                    <ul className='mt-2 list-disc space-y-1 pl-5 text-kd-foreground-muted'>
                      <li>과거 날짜는 지정할 수 없습니다.</li>
                      <li>공개일로부터 7일 이후 날짜를 선택해 주세요.</li>
                      <li>같은 약관의 가장 최근 공개 시행일보다 이후여야 합니다. 초안·철회 버전은 제외합니다.</li>
                      <li>초안 저장 시에는 시행일을 검증하지 않습니다.</li>
                    </ul>
                  </details>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='term-body'>본문 *</Label>
                  <Textarea
                    ref={bodyRef}
                    id='term-body'
                    className='h-96 min-h-96 resize-y'
                    style={{ fieldSizing: 'fixed' }}
                    value={body}
                    readOnly={isPending}
                    aria-invalid={error?.field === 'body'}
                    aria-describedby='term-body-help'
                    onChange={(event) => setBody(event.target.value)}
                  />
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
                  <p className='mt-5 whitespace-pre-wrap text-kd-body'>{body}</p>
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
