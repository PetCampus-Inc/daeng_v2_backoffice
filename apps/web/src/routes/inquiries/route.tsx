import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useListReturnPosition } from '@/util/use-list-return-position';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/ui/atoms/button';
import { Card } from '@/ui/atoms/card';
import { Input } from '@/ui/atoms/input';
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/ui/atoms/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/atoms/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import { ListState } from '@/ui/molecules/list-state';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { inquiriesQueryOptions, inquiryAssigneesQueryOptions } from './api/inquiries/index';
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUSES,
  INQUIRY_USER_TYPE_LABELS,
  INQUIRY_USER_TYPES,
  type InquiryListParams,
} from './type/inquiry';
import { InquiryAssigneeName } from './ui/inquiry-assignee-name';
import { InquiryStatusBadge } from './ui/inquiry-status-badge';
import { formatAssigneeName, formatInquiryUser } from './util/inquiry-format';
import { useInquiryListSearchParams } from './util/list-search-params';

/** 서비스 운영 > 1:1 문의 목록(PRD 7.3). 조건은 주소에 두어 상세에서 돌아와도 그대로다. */
export default function InquiriesRoute() {
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const assigneeTriggerRef = useRef<HTMLButtonElement>(null);
  const { listParams, page, listSearch, setSearchParams } = useInquiryListSearchParams();
  const inquiriesQuery = useQuery(inquiriesQueryOptions(currentEmail, listParams, page - 1));
  const assigneesQuery = useQuery(inquiryAssigneesQueryOptions(currentEmail));
  const inquiries = inquiriesQuery.data?.items ?? [];
  const totalPages = inquiriesQuery.data?.totalPages ?? 0;
  const hasCondition =
    listParams.keyword !== '' ||
    listParams.status !== 'all' ||
    listParams.userType !== 'all' ||
    listParams.assignee !== 'all';
  const isListShown = inquiriesQuery.isSuccess;
  const saveReturnPosition = useListReturnPosition(
    `inquiries:${currentEmail}:${listSearch}`,
    isListShown && !inquiriesQuery.isPlaceholderData
  );

  /** 검색·필터를 바꾸면 1페이지로 간다(PRD 4.4). */
  const handleChangeCondition = (condition: Partial<InquiryListParams>) =>
    void setSearchParams({ ...condition, page: null });
  /** 검색어와 필터를 처음 값으로 되돌린다. 정렬은 그대로 둔다. */
  const handleResetFilters = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void setSearchParams({ keyword: null, status: null, userType: null, assignee: null, page: null });
  };
  const handleRetry = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void inquiriesQuery.refetch();
  };
  const handleChangePage = (nextPage: number) => {
    if (inquiriesQuery.isPlaceholderData || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage });
  };
  /** 지금 목록 조건을 상세 주소에 이어 붙여 이전·다음 문의와 목록 복귀에 쓴다. */
  const handleOpenInquiry = (id: number) => {
    if (inquiriesQuery.isPlaceholderData) return;
    saveReturnPosition(id);
    void navigate({ pathname: `${PAGES.inquiries.path}/${id}`, search: listSearch });
  };

  return (
    <>
      <title>{formatDocumentTitle(PAGES.inquiries.title)}</title>
      <h1 className='text-kd-title-1'>{PAGES.inquiries.title}</h1>
      <Card className='mt-6' aria-busy={inquiriesQuery.isFetching}>
        <div className='flex flex-wrap items-center gap-2 p-4'>
          <Input
            ref={searchInputRef}
            type='search'
            aria-label='검색'
            placeholder='제목, 사용자, 문의 번호, 대화 내용'
            className='w-72 max-[767px]:w-full'
            value={listParams.keyword}
            onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
          />
          <Select
            value={listParams.status}
            onValueChange={(value) => handleChangeCondition({ status: value as InquiryListParams['status'] })}
          >
            <SelectTrigger aria-label='상태' className='w-36'>
              <SelectValue>
                {listParams.status === 'all' ? '상태 전체' : INQUIRY_STATUS_LABELS[listParams.status]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {INQUIRY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {INQUIRY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={listParams.userType}
            onValueChange={(value) => handleChangeCondition({ userType: value as InquiryListParams['userType'] })}
          >
            <SelectTrigger aria-label='사용자 유형' className='w-40'>
              <SelectValue>
                {listParams.userType === 'all' ? '사용자 유형 전체' : INQUIRY_USER_TYPE_LABELS[listParams.userType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {INQUIRY_USER_TYPES.map((userType) => (
                <SelectItem key={userType} value={userType}>
                  {INQUIRY_USER_TYPE_LABELS[userType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={listParams.assignee} onValueChange={(value) => handleChangeCondition({ assignee: value })}>
            <SelectTrigger ref={assigneeTriggerRef} aria-label='담당자' className='w-52'>
              <SelectValue>
                {assigneesQuery.isPending
                  ? '담당자 불러오는 중…'
                  : listParams.assignee === 'all'
                    ? '담당자 전체'
                    : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              <SelectItem value='me'>내 담당</SelectItem>
              <SelectItem value='unassigned'>미배정</SelectItem>
              {assigneesQuery.data?.map((assignee) => (
                <SelectItem key={assignee.email} value={assignee.email}>
                  {formatAssigneeName(assignee)}
                  {!assignee.isActive && ' (비활성)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assigneesQuery.isError && (
            <div className='flex items-center gap-2'>
              <p role='status' className='text-kd-sub text-kd-foreground-muted'>
                담당자를 불러오지 못했습니다.
              </p>
              <Button
                variant='link'
                onClick={() => {
                  assigneeTriggerRef.current?.focus({ preventScroll: true });
                  void assigneesQuery.refetch();
                }}
              >
                담당자 다시 시도
              </Button>
            </div>
          )}
          {hasCondition && (
            <Button variant='link' onClick={handleResetFilters}>
              필터 초기화
            </Button>
          )}
          {isListShown && (
            <p role='status' className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
              {inquiriesQuery.isPlaceholderData ? '조회 중…' : `총 ${inquiriesQuery.data.totalElements}건`}
            </p>
          )}
        </div>
        {inquiriesQuery.isPending ? (
          <ListState kind='loading' />
        ) : inquiriesQuery.isError ? (
          <ListState kind='error' onAction={handleRetry} />
        ) : inquiriesQuery.isPlaceholderData && inquiries.length === 0 ? (
          <p
            role='status'
            className='flex min-h-48 items-center justify-center px-4 py-14 text-center text-kd-foreground-muted'
          >
            조건에 맞는 문의를 조회하고 있습니다.
          </p>
        ) : inquiries.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table scrollLabel='문의 목록 가로 스크롤'>
              <caption className='sr-only'>문의 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-kd-col-number'>문의 번호</TableHead>
                  <TableHead className='w-kd-col-status'>상태</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>사용자</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead
                    className='w-kd-col-time'
                    sort={listParams.sort === 'latest' ? 'descending' : 'ascending'}
                    onSort={() => void setSearchParams({ sort: listParams.sort === 'latest' ? 'oldest' : null })}
                  >
                    최근 활동
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id} className='cursor-pointer' onClick={() => handleOpenInquiry(inquiry.id)}>
                    <TableCell className='text-kd-foreground-muted tabular-nums'>#{inquiry.id}</TableCell>
                    <TableCell>
                      <InquiryStatusBadge status={inquiry.status} />
                    </TableCell>
                    <TableCell className='max-w-80'>
                      <button
                        type='button'
                        aria-disabled={inquiriesQuery.isPlaceholderData}
                        data-list-item-id={inquiry.id}
                        className='block max-w-full truncate rounded-kd-2 text-left font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenInquiry(inquiry.id);
                        }}
                      >
                        {inquiry.title}
                      </button>
                    </TableCell>
                    <TableCell>{formatInquiryUser(inquiry.user)}</TableCell>
                    <TableCell>
                      <InquiryAssigneeName assignee={inquiry.assignee} />
                    </TableCell>
                    <TableCell className='tabular-nums'>{formatDate(inquiry.lastActivityAt, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <Pagination className='border-t border-kd-border p-4'>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                      aria-disabled={page <= 1 || inquiriesQuery.isPlaceholderData}
                      onClick={() => handleChangePage(page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        isActive={pageNumber === page}
                        className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                        aria-disabled={inquiriesQuery.isPlaceholderData}
                        onClick={() => handleChangePage(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                      aria-disabled={page >= totalPages || inquiriesQuery.isPlaceholderData}
                      onClick={() => handleChangePage(page + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </Card>
    </>
  );
}
