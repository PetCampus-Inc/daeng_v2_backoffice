import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import { ListState } from '@/ui/molecules/list-state';
import { ReadOnlyDbBadge } from '@/ui/molecules/read-only-db-badge';
import { cn } from '@/util/cn';
import { formatDocumentTitle } from '@/util/page-config';
import { kindergartensQueryOptions } from './api/kindergartens/index';
import type { KindergartenListParams } from './type/kindergarten';
import { useKindergartenListParams } from './util/list-search-params';

const STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'ACTIVE', label: '운영 중' },
  { value: 'CLOSED', label: '폐업' },
] as const;

/** 기존 유치원 조회 화면을 목록 공통 규칙에 맞춰 제공한다(TC 12). */
export default function KindergartensRoute() {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const { listParams, queryParams, page, setSearchParams } = useKindergartenListParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paginationRef = useRef<HTMLElement>(null);
  const pageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const kindergartensQuery = useQuery(kindergartensQueryOptions(email, queryParams, page - 1));
  useEffect(() => {
    if (kindergartensQuery.isFetching || !pageTriggerRef.current) return;
    // 비활성화·제거된 버튼에서 초점을 잃은 경우만 복구한다. 사용자가 다른 곳으로 이동했다면 유지한다.
    if (document.activeElement === document.body || document.activeElement === pageTriggerRef.current) {
      const target = paginationRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]');
      (target ?? searchInputRef.current)?.focus({ preventScroll: true });
    }
    pageTriggerRef.current = null;
  }, [kindergartensQuery.isFetching]);
  const items = kindergartensQuery.data?.items ?? [];
  const totalPages = kindergartensQuery.data?.totalPages ?? 0;
  const hasCondition = queryParams.keyword.trim() !== '' || queryParams.status !== 'all';
  const handleChangeCondition = (condition: Partial<KindergartenListParams>) => {
    pageTriggerRef.current = null;
    void setSearchParams({ ...condition, page: null });
  };
  const handleChangePage = (nextPage: number, trigger: HTMLButtonElement) => {
    if (nextPage === page) return;
    pageTriggerRef.current = trigger;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage });
  };
  const handleResetFilters = () => {
    pageTriggerRef.current = null;
    searchInputRef.current?.focus({ preventScroll: true });
    void setSearchParams({ keyword: null, status: null, page: null });
  };
  const handleRetry = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void kindergartensQuery.refetch();
  };

  return (
    <>
      <title>{formatDocumentTitle('유치원 관리')}</title>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-kd-title-1'>유치원 관리</h1>
          <p className='mt-1 text-kd-sub text-kd-foreground-muted'>등록된 유치원과 운영 상태를 관리합니다.</p>
        </div>
        <ReadOnlyDbBadge />
      </div>
      <Card className='mt-6 gap-0 overflow-hidden' aria-busy={kindergartensQuery.isFetching}>
        <div role='group' aria-label='운영 상태 필터' className='flex border-b border-kd-border px-4'>
          {STATUS_FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              type='button'
              variant='ghost'
              aria-pressed={listParams.status === value}
              className={cn(
                'h-12 rounded-none border-b-2 px-4',
                listParams.status === value && 'border-b-kd-primary text-kd-primary'
              )}
              onClick={() => handleChangeCondition({ status: value })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2 p-4'>
          <Input
            ref={searchInputRef}
            type='search'
            aria-label='유치원 검색'
            placeholder='유치원명, 원장명 또는 지역 검색'
            className='w-80 max-[767px]:w-full'
            value={listParams.keyword}
            onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
          />
          {kindergartensQuery.isSuccess && (
            <p role='status' className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
              {kindergartensQuery.isPlaceholderData
                ? '조회 중…'
                : `총 ${kindergartensQuery.data.totalElements.toLocaleString('ko-KR')}건`}
            </p>
          )}
        </div>
        {kindergartensQuery.isPending ? (
          <ListState kind='loading' />
        ) : kindergartensQuery.isError ? (
          <ListState kind='error' onAction={handleRetry} />
        ) : kindergartensQuery.isPlaceholderData && items.length === 0 ? (
          <p role='status' className='px-4 py-14 text-center text-kd-foreground-muted'>
            조건에 맞는 유치원을 조회하고 있습니다.
          </p>
        ) : items.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table scrollLabel='유치원 목록 가로 스크롤'>
              <caption className='sr-only'>유치원 목록</caption>
              <TableHeader>
                <TableRow>
                  {['유치원', '대표 원장', '지역', '운영 상태', '원생', '사업자 인증'].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                  <TableHead>
                    <span className='sr-only'>추가 메뉴</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className='flex items-center gap-3'>
                        <span
                          aria-hidden
                          className='flex size-9 shrink-0 items-center justify-center rounded-full bg-kd-surface font-semibold text-kd-foreground-muted'
                        >
                          {Array.from(item.name)[0] || '?'}
                        </span>
                        <div>
                          <p className='font-semibold'>{item.name}</p>
                          <p className='text-kd-caption text-kd-foreground-muted'>SCHOOL-{item.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.ownerName || '원장 미연결'}</TableCell>
                    <TableCell>{item.address}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          item.status === 'ACTIVE' ? 'text-kd-success-foreground' : 'text-kd-error-foreground'
                        )}
                      >
                        <span aria-hidden className='size-1.5 rounded-full bg-current' />
                        {item.status === 'ACTIVE' ? '활성' : '폐업'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.activeMembers.toLocaleString('ko-KR')}명{' '}
                      <span className='text-kd-caption text-kd-foreground-muted'>
                        대기 {item.pendingMembers.toLocaleString('ko-KR')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          item.businessVerified ? 'text-kd-success-foreground' : 'text-kd-warning-foreground'
                        )}
                      >
                        <span aria-hidden className='size-1.5 rounded-full bg-current' />
                        {item.businessVerified ? '인증' : '미인증'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* S-유치원-006 동작은 미정이며 조회 전용으로 유지한다. */}
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        disabled
                        aria-label={`${item.name} 추가 메뉴 (조회 전용)`}
                        title='조회 전용 목록입니다.'
                      >
                        ⋯
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <Pagination ref={paginationRef} className='border-t border-kd-border p-4'>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={page <= 1 || kindergartensQuery.isPlaceholderData}
                      onClick={(event) => handleChangePage(page - 1, event.currentTarget)}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        isActive={pageNumber === page}
                        disabled={kindergartensQuery.isPlaceholderData}
                        onClick={(event) => handleChangePage(pageNumber, event.currentTarget)}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      disabled={page >= totalPages || kindergartensQuery.isPlaceholderData}
                      onClick={(event) => handleChangePage(page + 1, event.currentTarget)}
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
