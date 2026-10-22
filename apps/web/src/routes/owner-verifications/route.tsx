import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { VERIFICATION_STATUS_LABELS } from '@/type/overview';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/atoms/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import { ListState } from '@/ui/molecules/list-state';
import { ReadOnlyDbBadge } from '@/ui/molecules/read-only-db-badge';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle } from '@/util/page-config';
import { ownerVerificationsQueryOptions } from './api/owner-verifications';
import {
  OWNER_VERIFICATION_SORT_LABELS,
  OWNER_VERIFICATION_SORTS,
  OWNER_VERIFICATION_TABS,
  type OwnerVerificationListParams,
  type OwnerVerificationSort,
} from './type/owner-verification';
import { VerificationDetailPanel } from './ui/verification-detail-panel';
import { useOwnerVerificationListParams } from './util/list-search-params';

const PAGE_TITLE = '원장 인증 현황';

const STATUS_TABS = [
  { value: 'all', label: '전체' },
  ...OWNER_VERIFICATION_TABS.map((value) => ({ value, label: VERIFICATION_STATUS_LABELS[value] })),
] as const;

/** 기존 원장 인증 현황 화면을 목록 공통 규칙에 맞춰 옮겼다. 상세는 목록 오른쪽 패널이다(TC 13). */
export default function OwnerVerificationsRoute() {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const { listParams, queryParams, page, selected, setSearchParams } = useOwnerVerificationListParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paginationRef = useRef<HTMLElement>(null);
  const pageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const verificationsQuery = useQuery(ownerVerificationsQueryOptions(email, queryParams, page - 1));
  useEffect(() => {
    if (verificationsQuery.isFetching || !pageTriggerRef.current) return;
    // 비활성화·제거된 버튼에서 초점을 잃은 경우만 복구한다. 사용자가 다른 곳으로 이동했다면 유지한다.
    if (document.activeElement === document.body || document.activeElement === pageTriggerRef.current) {
      const target = paginationRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]');
      (target ?? searchInputRef.current)?.focus({ preventScroll: true });
    }
    pageTriggerRef.current = null;
  }, [verificationsQuery.isFetching]);
  const items = verificationsQuery.data?.items ?? [];
  const totalPages = verificationsQuery.data?.totalPages ?? 0;
  const isTransitioning = verificationsQuery.isPlaceholderData;
  // 실패한 조건을 다시 시도하는 중에는 다른 조건의 이전 표 대신 불러오는 중으로 보인다(S-인증-024).
  const isRetrying = isTransitioning && verificationsQuery.errorUpdatedAt > 0;
  // 조회 중인 이전 결과나 지금 목록에 없는 번호는 고른 건으로 보지 않는다(S-인증-017).
  const selectedItem =
    selected === null || isTransitioning || !verificationsQuery.isSuccess
      ? undefined
      : items.find((item) => item.id === selected);
  const hasCondition = queryParams.keyword.trim() !== '' || queryParams.sort !== 'latest';
  /** 탭·검색어·정렬을 바꾸면 1페이지로 가고 고른 건을 푼다(S-인증-004·009·010). */
  const handleChangeCondition = (condition: Partial<OwnerVerificationListParams>) => {
    pageTriggerRef.current = null;
    void setSearchParams({ ...condition, page: null, selected: null });
  };
  /** 페이지를 옮기면 고른 건을 푼다. 다른 페이지의 건이 패널에 남지 않게 한다. */
  const handleChangePage = (nextPage: number, trigger: HTMLButtonElement) => {
    if (nextPage === page) return;
    pageTriggerRef.current = trigger;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage, selected: null });
  };
  /** 검색어·정렬을 처음으로 돌린다. 탭은 그대로 둔다(S-인증-009). */
  const handleResetFilters = () => {
    pageTriggerRef.current = null;
    searchInputRef.current?.focus({ preventScroll: true });
    void setSearchParams({ keyword: null, sort: null, page: null, selected: null });
  };
  /** 다시 시도하면 사라지는 버튼 대신 검색창에 초점을 둔다(S-인증-024). */
  const handleRetry = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    void verificationsQuery.refetch();
  };
  /** 행을 고르면 주소의 고른 건만 바꾼다. 기록은 교체한다(4.3). 조건 전환 중 남아 있는 이전 행은 고르지 않는다. */
  const handleSelectVerification = (id: number) => {
    if (isTransitioning) return;
    void setSearchParams({ selected: id });
  };

  return (
    <>
      <title>{formatDocumentTitle(PAGE_TITLE)}</title>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-kd-title-1'>{PAGE_TITLE}</h1>
          <p className='mt-1 text-kd-sub text-kd-foreground-muted'>
            자동 사업자 인증과 원장 권한 연결 상태를 조회합니다.
          </p>
        </div>
        <ReadOnlyDbBadge />
      </div>
      <div className='mt-6 grid grid-cols-[minmax(0,1fr)_390px] items-start gap-[18px] max-[1180px]:grid-cols-1'>
        <Card className='gap-0 overflow-hidden' aria-busy={verificationsQuery.isFetching}>
          <div role='group' aria-label='인증 단계 필터' className='flex overflow-x-auto border-b border-kd-border px-4'>
            {STATUS_TABS.map(({ value, label }) => (
              <Button
                key={value}
                type='button'
                variant='ghost'
                aria-pressed={listParams.status === value}
                className={cn(
                  'h-12 shrink-0 rounded-none border-b-2 px-4',
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
              aria-label='원장 인증 검색'
              placeholder='신청자 또는 유치원 검색'
              className='w-72 max-[767px]:w-full'
              value={listParams.keyword}
              onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
            />
            <Select
              value={listParams.sort}
              onValueChange={(value) => handleChangeCondition({ sort: value as OwnerVerificationSort })}
            >
              <SelectTrigger aria-label='정렬' className='w-32'>
                <SelectValue>{OWNER_VERIFICATION_SORT_LABELS[listParams.sort]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OWNER_VERIFICATION_SORTS.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {OWNER_VERIFICATION_SORT_LABELS[sort]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasCondition && (
              <Button variant='link' onClick={handleResetFilters}>
                필터 초기화
              </Button>
            )}
            {verificationsQuery.isSuccess && !isRetrying && (
              <p role='status' className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
                {isTransitioning ? '조회 중…' : `총 ${verificationsQuery.data.totalElements.toLocaleString('ko-KR')}건`}
              </p>
            )}
          </div>
          {verificationsQuery.isPending || isRetrying ? (
            <ListState kind='loading' />
          ) : verificationsQuery.isError ? (
            <ListState kind='error' onAction={handleRetry} />
          ) : isTransitioning && items.length === 0 ? (
            <p role='status' className='px-4 py-14 text-center text-kd-foreground-muted'>
              조건에 맞는 인증 건을 조회하고 있습니다.
            </p>
          ) : items.length === 0 ? (
            hasCondition ? (
              <ListState kind='no-results' onAction={handleResetFilters} />
            ) : (
              <ListState kind='empty' />
            )
          ) : (
            <>
              {/* 오른쪽 패널(390)과 나란히 두므로 기존 화면처럼 최소 폭 650을 쓴다(service-admin.html 기준). */}
              <Table scrollLabel='원장 인증 목록 가로 스크롤' className='min-w-[650px]!'>
                <caption className='sr-only'>원장 인증 목록</caption>
                <TableHeader>
                  <TableRow>
                    {['신청자', '유치원', '지역', '신청일', '단계'].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isSelected = item.id === selectedItem?.id;
                    const name = item.userName || '—';
                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'cursor-pointer',
                          isSelected && 'bg-kd-surface-accent! shadow-[inset_3px_0_var(--kd-primary)]'
                        )}
                        onClick={() => handleSelectVerification(item.id)}
                      >
                        <TableCell>
                          <button
                            type='button'
                            aria-pressed={isSelected}
                            aria-disabled={isTransitioning}
                            className='flex items-center gap-3 rounded-kd-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectVerification(item.id);
                            }}
                          >
                            <span
                              aria-hidden
                              className='flex size-9 shrink-0 items-center justify-center rounded-full bg-kd-surface font-semibold text-kd-foreground-muted'
                            >
                              {Array.from(name)[0]}
                            </span>
                            <span className='font-semibold'>{name}</span>
                          </button>
                        </TableCell>
                        <TableCell className='font-semibold'>{item.kindergartenName || '—'}</TableCell>
                        <TableCell>{item.kindergartenAddress || '—'}</TableCell>
                        <TableCell className='tabular-nums'>{formatDate(item.submittedAt)}</TableCell>
                        <TableCell>
                          <Badge variant='warning'>
                            {VERIFICATION_STATUS_LABELS[item.status] ?? item.status ?? '—'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <Pagination ref={paginationRef} className='border-t border-kd-border p-4'>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        disabled={page <= 1 || isTransitioning}
                        onClick={(event) => handleChangePage(page - 1, event.currentTarget)}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationButton
                          isActive={pageNumber === page}
                          disabled={isTransitioning}
                          onClick={(event) => handleChangePage(pageNumber, event.currentTarget)}
                        >
                          {pageNumber}
                        </PaginationButton>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        disabled={page >= totalPages || isTransitioning}
                        onClick={(event) => handleChangePage(page + 1, event.currentTarget)}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </Card>
        <VerificationDetailPanel item={selectedItem} isLoadError={verificationsQuery.isError} />
      </div>
    </>
  );
}
