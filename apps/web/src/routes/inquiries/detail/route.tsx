import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '@/store/auth';
import { useLeaveGuard } from '@/store/leave-guard';
import type { ApiError } from '@/type/api';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/ui/atoms/breadcrumb';
import { Button } from '@/ui/atoms/button';
import { Card } from '@/ui/atoms/card';
import { Field, FieldCounter, FieldDescription, FieldError } from '@/ui/atoms/field';
import { showErrorToast, showSuccessToast, showUndoToast } from '@/ui/atoms/sonner';
import { Textarea } from '@/ui/atoms/textarea';
import { ListState } from '@/ui/molecules/list-state';
import { countCharacters } from '@/util/profile';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import {
  inquiryAdjacentQueryOptions,
  inquiryQueryOptions,
  useAssignInquiry,
  useReleaseInquiry,
  useReplyInquiry,
  useRestoreInquiryAssignee,
} from '../api/inquiries';
import { INQUIRY_ERROR_CODES, type InquiryAssignee, type InquiryDetail } from '../type/inquiry';
import { InquiryAssigneeName } from '../ui/inquiry-assignee-name';
import { InquiryStatusBadge } from '../ui/inquiry-status-badge';
import { formatAssigneeName } from '../util/inquiry-format';
import { getAssignAction, getInquiryViewMode, needsReleaseConfirm } from '../util/inquiry-policy';
import { canSubmitReply, getReplyLengthError, REPLY_MAX_LENGTH } from '../util/reply-input';
import { useInquiryListSearchParams } from '../util/list-search-params';
import { Conversation } from './ui/conversation';
import { InquiryInfo } from './ui/inquiry-info';

const GENERIC_ERROR_MESSAGE = '일시적 오류로 요청을 완료하지 못했습니다.';
const NOT_ASSIGNEE_NOTICE = "답변은 담당자만 할 수 있습니다. 직접 답변하려면 '내가 맡기'를 눌러 주세요.";
const RESOLVED_NOTICE = '해결 완료된 문의라 답변과 담당 변경을 할 수 없습니다.';

/** 서버가 준 거부 사유 코드를 읽는다. */
const getInquiryErrorCode = (error: unknown) =>
  axios.isAxiosError<ApiError>(error) ? error.response?.data?.code : undefined;

/** 상세 대상 없음(PRD 4.5). 본문 자리에 '페이지를 찾을 수 없습니다.' + [목록으로]. */
function InquiryNotFound() {
  return (
    <>
      <title>{formatDocumentTitle('페이지를 찾을 수 없음')}</title>
      <Card>
        <ListState kind='missing' listPath={PAGES.inquiries.path} />
      </Card>
    </>
  );
}

/** 회색 바탕 안내 한 줄(design.md 3.11). 담당자가 아니거나 해결 완료일 때 답변 입력 대신 둔다. */
function ReplyNotice({ children }: { children: string }) {
  return <p className='rounded-kd-3 bg-kd-surface px-4 py-3 text-kd-body text-kd-foreground-muted'>{children}</p>;
}

/** 문의 상세(PRD 7.4). 주소의 번호가 숫자만이 아니면(`1e3`, `0x10`, 앞 공백 등) 없는 문의로 본다. */
export default function InquiryDetailRoute() {
  const { inquiryId = '' } = useParams();
  if (!/^\d+$/.test(inquiryId)) return <InquiryNotFound />;
  // 다른 문의로 옮기면 쓰던 답변·확인창 상태를 새로 시작한다.
  return <InquiryDetailContent key={inquiryId} id={Number(inquiryId)} />;
}

/** 문의 한 건의 머리·대화·답변·정보. */
function InquiryDetailContent({ id }: { id: number }) {
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { listParams, listSearch } = useInquiryListSearchParams();
  const inquiryQuery = useQuery(inquiryQueryOptions(currentEmail, id));
  const adjacentQuery = useQuery({
    ...inquiryAdjacentQueryOptions(currentEmail, id, listParams),
    enabled: inquiryQuery.isSuccess,
  });
  const assignMutation = useAssignInquiry(currentEmail);
  const releaseMutation = useReleaseInquiry(currentEmail);
  const restoreMutation = useRestoreInquiryAssignee(currentEmail);
  const replyMutation = useReplyInquiry(currentEmail);
  const [draft, setDraft] = useState('');
  const [confirmAssignee, setConfirmAssignee] = useState<InquiryAssignee | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  // 저장 순간 담당자가 바뀌어 저장하지 못한 답변. 복사할 수 있게 남기고 저장은 막는다(FR-BO-058).
  const [isDraftLocked, setIsDraftLocked] = useState(false);
  const isDirty = draft !== '';
  const isActionPending =
    assignMutation.isPending || releaseMutation.isPending || restoreMutation.isPending || replyMutation.isPending;
  // 쓰던 답변이 있으면 화면 이동·로그아웃 전에 앱 이탈 확인창(AppLayout)을 거친다(PRD 4.6).
  useLeaveGuard({ isDirty, description: '저장하지 않은 답변을 버립니다.', discard: () => setDraft('') });

  /** 다른 사람이 먼저 바꾼 문의를 최신 값으로 다시 읽는다. */
  const refetchInquiry = async () => (await inquiryQuery.refetch()).data;

  /** 해결 완료로 거부되면 최신 상태로 바꾸고 쓰던 답변을 비운다(FR-BO-059). */
  const handleResolvedRejection = async () => {
    setDraft('');
    setIsDraftLocked(false);
    await refetchInquiry();
  };

  /** 화면에서 본 담당자를 보내 맡는다. 그 사이 바뀌었으면 최신 담당자로 다시 판단한다(FR-BO-054). */
  const requestAssign = async (expectedAssigneeEmail: string | null): Promise<void> => {
    try {
      await assignMutation.mutateAsync({ id, expectedAssigneeEmail });
      setIsDraftLocked(false);
      showSuccessToast(expectedAssigneeEmail ? '담당자를 변경했습니다.' : '문의를 맡았습니다.');
    } catch (error) {
      const code = getInquiryErrorCode(error);
      if (code === INQUIRY_ERROR_CODES.assigneeChanged) {
        const latest = await refetchInquiry();
        if (!latest) return;
        const action = getAssignAction(latest.assignee?.email ?? null, currentEmail);
        if (action === 'assign') await requestAssign(null);
        else if (action === 'confirm') setConfirmAssignee(latest.assignee);
        return;
      }
      if (code === INQUIRY_ERROR_CODES.resolved) {
        await handleResolvedRejection();
        return;
      }
      showErrorToast(GENERIC_ERROR_MESSAGE);
    }
  };

  /** [내가 맡기]: 미배정이면 바로, 다른 팀원 담당이면 담당 변경 확인창부터. */
  const handleClickAssign = (inquiry: InquiryDetail) => {
    const action = getAssignAction(inquiry.assignee?.email ?? null, currentEmail);
    if (action === 'assign') void requestAssign(null);
    else if (action === 'confirm') setConfirmAssignee(inquiry.assignee);
  };

  /** 담당 해제를 실행 취소한다. 그 사이 다른 사람이 맡았으면 최신 담당자를 보여 준다. */
  const handleUndoRelease = async () => {
    try {
      await restoreMutation.mutateAsync(id);
      showSuccessToast('담당 해제를 취소했습니다.');
    } catch (error) {
      const code = getInquiryErrorCode(error);
      if (code === INQUIRY_ERROR_CODES.assigneeChanged || code === INQUIRY_ERROR_CODES.resolved) {
        // 이 화면을 떠난 뒤에 눌러도 같은 문의를 다시 읽게 한다.
        await queryClient.invalidateQueries({ queryKey: inquiryQueryOptions(currentEmail, id).queryKey });
        return;
      }
      showErrorToast(GENERIC_ERROR_MESSAGE);
    }
  };

  /** 담당을 해제하고 쓰던 답변을 비운 뒤 실행 취소 토스트(8초)를 띄운다(FR-BO-055). */
  const requestRelease = async () => {
    try {
      await releaseMutation.mutateAsync(id);
      setDraft('');
      setIsDraftLocked(false);
      showUndoToast('담당을 해제했습니다.', () => void handleUndoRelease());
    } catch (error) {
      const code = getInquiryErrorCode(error);
      if (code === INQUIRY_ERROR_CODES.resolved) await handleResolvedRejection();
      else if (code === INQUIRY_ERROR_CODES.assigneeChanged) await refetchInquiry();
      else showErrorToast(GENERIC_ERROR_MESSAGE);
    }
  };

  /** [담당 해제]: 쓰던 답변이 있으면 이탈 확인창 대신 담당 해제 확인창을 연다. */
  const handleClickRelease = () => {
    if (needsReleaseConfirm(draft)) setIsReleaseConfirmOpen(true);
    else void requestRelease();
  };

  /** 답변을 저장한다. 성공하면 입력을 비우고, 담당자가 바뀌었으면 입력을 남긴 채 저장을 막는다(FR-BO-057, 058). */
  const handleSubmitReply = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDraftLocked || !canSubmitReply(draft, replyMutation.isPending)) return;
    try {
      await replyMutation.mutateAsync({ id, body: draft });
      setDraft('');
      showSuccessToast('답변을 저장했습니다. 사용자에게 알림이 전달됩니다.');
    } catch (error) {
      const code = getInquiryErrorCode(error);
      if (code === INQUIRY_ERROR_CODES.assigneeChanged) {
        setIsDraftLocked(true);
        await refetchInquiry();
        showErrorToast('담당자가 변경되었습니다.');
        return;
      }
      if (code === INQUIRY_ERROR_CODES.resolved) {
        await handleResolvedRejection();
        return;
      }
      showErrorToast(GENERIC_ERROR_MESSAGE);
    }
  };

  /** 같은 목록 조건을 유지한 채 앞뒤 문의로 옮긴다. 기록은 교체한다(PRD 4.3). */
  const handleMoveInquiry = (targetId: number) =>
    navigate({ pathname: `${PAGES.inquiries.path}/${targetId}`, search: listSearch }, { replace: true });

  if (inquiryQuery.isPending) {
    return (
      <Card>
        <ListState kind='loading' />
      </Card>
    );
  }
  if (inquiryQuery.isError) {
    return axios.isAxiosError(inquiryQuery.error) && inquiryQuery.error.response?.status === 404 ? (
      <InquiryNotFound />
    ) : (
      <Card>
        <ListState kind='error' onAction={() => void inquiryQuery.refetch()} />
      </Card>
    );
  }

  const inquiry = inquiryQuery.data;
  const viewMode = getInquiryViewMode(inquiry.status, inquiry.assignee?.email ?? null, currentEmail);
  const isReplyFormShown = viewMode === 'mine' || (viewMode === 'notMine' && isDraftLocked);
  const replyLengthError = getReplyLengthError(draft);
  const prevId = adjacentQuery.data?.prevId ?? null;
  const nextId = adjacentQuery.data?.nextId ?? null;

  return (
    <>
      <title>{formatDocumentTitle(inquiry.title)}</title>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <Breadcrumb className='mb-0'>
          <BreadcrumbList>
            <BreadcrumbItem>서비스 운영</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={{ pathname: PAGES.inquiries.path, search: listSearch }}>{PAGES.inquiries.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>문의 #{inquiry.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={prevId === null}
            onClick={() => prevId !== null && handleMoveInquiry(prevId)}
          >
            ‹ 이전 문의
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={nextId === null}
            onClick={() => nextId !== null && handleMoveInquiry(nextId)}
          >
            다음 문의 ›
          </Button>
        </div>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='min-w-0 text-kd-title-1 [overflow-wrap:anywhere]'>{inquiry.title}</h1>
        <div className='flex items-center gap-3'>
          <p className='text-kd-body'>
            <span className='sr-only'>담당 </span>
            <InquiryAssigneeName assignee={inquiry.assignee} />
          </p>
          {viewMode === 'mine' && (
            <Button variant='outline' disabled={isActionPending} onClick={handleClickRelease}>
              담당 해제
            </Button>
          )}
          {viewMode === 'notMine' && (
            <Button disabled={isActionPending} onClick={() => handleClickAssign(inquiry)}>
              내가 맡기
            </Button>
          )}
        </div>
      </div>
      <div className='mt-3'>
        <InquiryStatusBadge status={inquiry.status} />
      </div>
      {/* 상세 2열: 왼쪽 1fr + 오른쪽 정보 320(design.md 2장, 시안 값이라 토큰이 없다). 1199px 이하 한 열 */}
      <div className='mt-6 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1199px]:grid-cols-1'>
        <Card>
          <Conversation messages={inquiry.messages} />
          <div className='border-t border-kd-border p-6'>
            {viewMode === 'resolved' ? (
              <ReplyNotice>{RESOLVED_NOTICE}</ReplyNotice>
            ) : isReplyFormShown ? (
              <form onSubmit={handleSubmitReply} noValidate className='flex flex-col gap-3'>
                <Field invalid={!!replyLengthError}>
                  <Textarea
                    aria-label='답변'
                    value={draft}
                    readOnly={isDraftLocked}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex flex-col gap-1'>
                      <FieldDescription>
                        저장하면 사용자에게 알림이 가고, 상태가 &apos;답변 도착&apos;으로 바뀌어요.
                      </FieldDescription>
                      <FieldError>{replyLengthError}</FieldError>
                    </div>
                    <FieldCounter current={countCharacters(draft)} max={REPLY_MAX_LENGTH} />
                  </div>
                </Field>
                <div className='flex justify-end'>
                  <Button type='submit' disabled={isDraftLocked || !canSubmitReply(draft, replyMutation.isPending)}>
                    답변 저장
                  </Button>
                </div>
              </form>
            ) : (
              <ReplyNotice>{NOT_ASSIGNEE_NOTICE}</ReplyNotice>
            )}
          </div>
        </Card>
        <InquiryInfo inquiry={inquiry} />
      </div>
      <AlertDialog open={confirmAssignee !== null} onOpenChange={(isOpen) => !isOpen && setConfirmAssignee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>담당자를 변경할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAssignee && `${formatAssigneeName(confirmAssignee)}님이 담당 중인 문의입니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAssignee && void requestAssign(confirmAssignee.email)}>
              담당자 변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isReleaseConfirmOpen} onOpenChange={setIsReleaseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>담당을 해제할까요?</AlertDialogTitle>
            <AlertDialogDescription>작성 중인 답변이 사라집니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void requestRelease()}>담당 해제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
