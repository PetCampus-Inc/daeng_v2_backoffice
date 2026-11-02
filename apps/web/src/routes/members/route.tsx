import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { Badge } from '@/ui/atoms/badge';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/atoms/select';
import { ListState } from '@/ui/molecules/list-state';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle } from '@/util/page-config';
import { membersQueryOptions } from './api/members/index';
import type { MemberJoinedPeriod, MemberListParams } from './type/member';
import { useMemberListParams } from './util/list-search-params';

const MEMBER_TABS = [
  { value: 'all', label: '전체' },
  { value: 'guardian', label: '견주' },
  { value: 'owner', label: '원장' },
  { value: 'withdrawn', label: '탈퇴' },
] as const;

/** TC 11의 조회 전용 회원 화면. 미확정 쓰기·내보내기 동작은 제공하지 않는다. */
export default function MembersRoute() {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const { listParams, queryParams, page, setSearchParams, setIsComposing } = useMemberListParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useQuery(membersQueryOptions(email, queryParams, page - 1));
  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const hasCondition =
    queryParams.keyword.trim() !== '' || queryParams.type !== 'all' || queryParams.joinedWithin !== 'all';
  const handleChangeCondition = (condition: Partial<MemberListParams>) =>
    void setSearchParams({ ...condition, page: null });
  const handleResetFilters = () => {
    inputRef.current?.focus({ preventScroll: true });
    void setSearchParams({ keyword: null, type: null, joinedWithin: null, page: null });
  };
  const handleRetry = () => {
    inputRef.current?.focus({ preventScroll: true });
    void query.refetch();
  };
  const handleChangePage = (nextPage: number) => {
    if (query.isPlaceholderData || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage });
  };
  return (
    <>
      <title>{formatDocumentTitle('회원 관리')}</title>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-kd-title-1'>회원 관리</h1>
          <p className='mt-1 text-kd-sub text-kd-foreground-muted'>서비스 회원의 상태와 역할을 조회하고 관리합니다.</p>
        </div>
        <Badge variant='success'>운영 DB · 읽기 전용</Badge>
      </div>
      <Card className='mt-6 gap-0 overflow-hidden' aria-busy={query.isFetching}>
        <div role='group' aria-label='회원 유형 필터' className='flex border-b border-kd-border px-4'>
          {MEMBER_TABS.map(({ value, label }) => (
            <Button
              key={value}
              type='button'
              variant='ghost'
              aria-pressed={listParams.type === value}
              className={cn(
                'h-12 rounded-none border-b-2 px-4',
                listParams.type === value && 'border-b-kd-primary text-kd-primary'
              )}
              onClick={() => handleChangeCondition({ type: value })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2 p-4'>
          <Input
            ref={inputRef}
            type='search'
            aria-label='회원 검색'
            placeholder='이름, 이메일 또는 회원 ID 검색'
            className='w-80 max-[767px]:w-full'
            value={listParams.keyword}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
          />
          <Select
            value={listParams.joinedWithin}
            onValueChange={(value) => handleChangeCondition({ joinedWithin: value as MemberJoinedPeriod })}
          >
            <SelectTrigger aria-label='가입일' className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>가입일 전체</SelectItem>
              <SelectItem value='7d'>최근 7일</SelectItem>
              <SelectItem value='30d'>최근 30일</SelectItem>
            </SelectContent>
          </Select>
          {query.isSuccess && (
            <p role='status' className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
              {query.isPlaceholderData ? '조회 중…' : `총 ${query.data.totalElements.toLocaleString('ko-KR')}건`}
            </p>
          )}
        </div>
        {query.isPending ? (
          <ListState kind='loading' />
        ) : query.isError ? (
          <ListState kind='error' onAction={handleRetry} />
        ) : query.isPlaceholderData && items.length === 0 ? (
          <p role='status' className='min-h-48 px-4 py-14 text-center text-kd-foreground-muted'>
            조건에 맞는 회원을 조회하고 있습니다.
          </p>
        ) : items.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table className='table-fixed' style={{ minWidth: 1120 }} scrollLabel='회원 목록 가로 스크롤'>
              <caption className='sr-only'>회원 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-80'>회원</TableHead>
                  <TableHead className='w-40'>회원 유형</TableHead>
                  <TableHead className='w-kd-col-status'>계정 상태</TableHead>
                  <TableHead className='w-kd-col-status'>원장 상태</TableHead>
                  <TableHead className='w-36'>가입일</TableHead>
                  <TableHead>최근 활동</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.userId}>
                    <TableCell>
                      <div className='flex min-w-0 items-center gap-3'>
                        <span
                          aria-hidden
                          className='flex size-9 shrink-0 items-center justify-center rounded-full bg-kd-surface font-semibold text-kd-foreground-muted'
                        >
                          {Array.from(item.name)[0] || '?'}
                        </span>
                        <div className='min-w-0'>
                          <p className='truncate font-semibold' title={item.name}>
                            {item.name}
                          </p>
                          <p
                            className='truncate text-kd-caption text-kd-foreground-muted'
                            title={`${item.email || item.phone || '연락처 미등록'} · ${item.userId}`}
                          >
                            {item.email || item.phone || '연락처 미등록'} · {item.userId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={item.isOwner ? 'border-kd-primary/20 bg-kd-primary/10 text-kd-primary' : undefined}
                      >
                        {[item.isOwner ? '원장' : '', item.isGuardian ? '견주' : ''].filter(Boolean).join(' · ') ||
                          '일반 회원'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          item.status === 'ACTIVE' ? 'text-kd-success-foreground' : 'text-kd-error-foreground'
                        )}
                      >
                        <span aria-hidden className='size-1.5 rounded-full bg-current' />
                        {item.status === 'ACTIVE' ? '활성' : '탈퇴'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.isOwner ? (
                        <span className='inline-flex items-center gap-1.5 text-kd-success-foreground'>
                          <span aria-hidden className='size-1.5 rounded-full bg-current' />
                          승인
                        </span>
                      ) : (
                        '미보유'
                      )}
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    {/* S-003 보류: 기존 열 제목과 반려견/유치원 표시를 그대로 유지한다. */}
                    <TableCell>
                      <p
                        className='truncate'
                        title={`${item.petCount}마리${item.schoolName ? ` · ${item.schoolName}` : ''}`}
                      >
                        {item.petCount}마리{item.schoolName ? ` · ${item.schoolName}` : ''}
                      </p>
                    </TableCell>
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
                      aria-disabled={page <= 1 || query.isPlaceholderData}
                      onClick={() => handleChangePage(page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                        isActive={pageNumber === page}
                        aria-disabled={query.isPlaceholderData}
                        onClick={() => handleChangePage(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                      aria-disabled={page >= totalPages || query.isPlaceholderData}
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
