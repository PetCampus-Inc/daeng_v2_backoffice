import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';
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
import { noticesQueryOptions } from './api/notices/index';
import { NoticeActions } from './ui/notice-actions';
import { NoticeStatusBadge } from './ui/notice-status-badge';
import { NOTICE_STATUS_LABELS, NOTICE_STATUSES, type NoticeListParams } from './type/notice';
import { useNoticeListSearchParams } from './util/list-search-params';

/** 앱 공지 목록. 검색·필터·페이지를 주소에 보존한다. */
export default function NoticesRoute() {
  const canWrite = useAuthStore((state) => state.user?.role !== 'viewer');
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { listParams, page, listSearch, setSearchParams } = useNoticeListSearchParams();
  const noticesQuery = useQuery(noticesQueryOptions(currentEmail, listParams, page - 1));
  const notices = noticesQuery.data?.items ?? [];
  const totalPages = noticesQuery.data?.totalPages ?? 0;
  const hasCondition = listParams.keyword !== '' || listParams.status !== 'all';
  const isListShown = noticesQuery.isSuccess;

  /** 검색·필터를 바꾸면 1페이지로 간다(PRD 4.4). */
  const handleChangeCondition = (condition: Partial<NoticeListParams>) =>
    void setSearchParams({ ...condition, page: null });
  /** 사라지는 초기화·재시도 버튼 대신 검색칸으로 초점을 이어 준다. */
  const handleResetFilters = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void setSearchParams({ keyword: null, status: null, page: null });
  };
  const handleRetry = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void noticesQuery.refetch();
  };
  /** 목록 조건을 상세 주소에 이어 붙여 목록 복귀에 쓴다. */
  const handleOpenNotice = (id: number) => navigate({ pathname: `${PAGES.notices.path}/${id}`, search: listSearch });
  /** 대기 중 버튼의 초점을 유지하되 직전 페이지 정보로 추가 이동하지 않는다. */
  const handleChangePage = (nextPage: number) => {
    if (noticesQuery.isPlaceholderData || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage });
  };

  return (
    <>
      <title>{formatDocumentTitle(PAGES.notices.title)}</title>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-kd-title-1'>{PAGES.notices.title}</h1>
        {canWrite && (
          <Button asChild>
            <Link to={{ pathname: `${PAGES.notices.path}/new`, search: listSearch }}>새 공지 작성</Link>
          </Button>
        )}
      </div>
      <Card className='mt-6' aria-busy={noticesQuery.isFetching}>
        <div className='flex flex-wrap items-center gap-2 p-4'>
          <Input
            ref={searchInputRef}
            type='search'
            aria-label='검색'
            placeholder='제목 검색'
            className='w-72 max-[767px]:w-full'
            value={listParams.keyword}
            onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
          />
          <Select
            value={listParams.status}
            onValueChange={(value) => handleChangeCondition({ status: value as NoticeListParams['status'] })}
          >
            <SelectTrigger aria-label='상태' className='w-40'>
              <SelectValue>
                {listParams.status === 'all' ? '상태 전체' : NOTICE_STATUS_LABELS[listParams.status]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {NOTICE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {NOTICE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasCondition && (
            <Button variant='link' onClick={handleResetFilters}>
              필터 초기화
            </Button>
          )}
          {isListShown && (
            <p role='status' className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
              {noticesQuery.isPlaceholderData ? '조회 중…' : `총 ${noticesQuery.data.totalElements}건`}
            </p>
          )}
        </div>
        {noticesQuery.isPending ? (
          <ListState kind='loading' />
        ) : noticesQuery.isError ? (
          <ListState kind='error' onAction={handleRetry} />
        ) : noticesQuery.isPlaceholderData && notices.length === 0 ? (
          <p
            role='status'
            className='flex min-h-48 items-center justify-center px-4 py-14 text-center text-kd-foreground-muted'
          >
            조건에 맞는 공지를 조회하고 있습니다.
          </p>
        ) : notices.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table scrollLabel='공지 목록 가로 스크롤'>
              <caption className='sr-only'>공지 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-kd-col-number'>공지 번호</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className='w-kd-col-time'>게시일</TableHead>
                  <TableHead className='w-kd-col-time'>마지막 수정</TableHead>
                  {canWrite && (
                    <TableHead>
                      <span className='sr-only'>작업</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((notice) => (
                  <TableRow key={notice.id} className='cursor-pointer' onClick={() => handleOpenNotice(notice.id)}>
                    <TableCell className='text-kd-foreground-muted tabular-nums'>#{notice.id}</TableCell>
                    <TableCell>
                      <NoticeStatusBadge status={notice.status} />
                    </TableCell>
                    <TableCell className='max-w-80'>
                      <button
                        type='button'
                        className='block max-w-full truncate rounded-kd-2 text-left font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenNotice(notice.id);
                        }}
                      >
                        {notice.title || '제목 없음'}
                      </button>
                    </TableCell>
                    <TableCell className='tabular-nums'>
                      {notice.publishedAt ? formatDate(notice.publishedAt) : ''}
                    </TableCell>
                    <TableCell className='tabular-nums'>{formatDate(notice.updatedAt, true)}</TableCell>
                    {canWrite && (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <NoticeActions notice={notice} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <Pagination className='border-t border-kd-border p-4'>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      aria-disabled={page <= 1 || noticesQuery.isPlaceholderData}
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                      onClick={() => handleChangePage(page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        isActive={pageNumber === page}
                        aria-disabled={noticesQuery.isPlaceholderData}
                        className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                        onClick={() => handleChangePage(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      aria-disabled={page >= totalPages || noticesQuery.isPlaceholderData}
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
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
