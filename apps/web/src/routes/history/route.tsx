import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/ui/atoms/button';
import { Card } from '@/ui/atoms/card';
import { Field, FieldError } from '@/ui/atoms/field';
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
import { formatProfileName } from '@/util/profile';
import { historiesQueryOptions, historyActorsQueryOptions, isForbiddenError } from './api/histories';
import {
  HISTORY_ACTION_LABELS,
  HISTORY_TARGET_TYPE_LABELS,
  HISTORY_TARGET_TYPES,
  type HistoryListParams,
  type HistoryPeriod,
} from './type/history';
import { formatHistoryChange, formatHistoryTarget } from './util/history-format';
import { useHistoryListSearchParams, type HistorySearchCondition } from './util/list-search-params';

const PERIOD_LABELS: Record<HistoryPeriod, string> = { all: '기간 전체', custom: '직접 입력' };
/** 키보드로 종료일을 시작일보다 앞서게 넣었을 때 종료일 칸 아래 문장. */
const RANGE_REVERSED_ERROR = '종료일은 시작일과 같거나 그 뒤여야 합니다.';

/** 변경 이력(PRD 7.12, 최고 관리자). 조회 전용이고 행을 눌러도 이동하지 않는다. 조건은 주소에 둔다. */
export default function HistoryRoute() {
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const actorTriggerRef = useRef<HTMLButtonElement>(null);
  const { listParams, page, setSearchParams } = useHistoryListSearchParams();
  const historiesQuery = useQuery(historiesQueryOptions(currentEmail, listParams, page - 1));
  const actorsQuery = useQuery(historyActorsQueryOptions(currentEmail));
  const records = historiesQuery.data?.items ?? [];
  const totalPages = historiesQuery.data?.totalPages ?? 0;
  const isCustomPeriod = listParams.period === 'custom';
  const hasCondition = isCustomPeriod || listParams.actor !== 'all' || listParams.targetType !== 'all';
  // 종료일 선택기는 시작일보다 앞선 날을 막지만(PRD 7.12) 키보드 입력·주소로는 들어올 수 있다.
  // 확정: 칸 값을 지우지 않고 종료일 칸에 빨간 테두리와 그 아래 오류 문장을 둔다.
  // 그 사이에 드는 기록이 없으므로 결과는 '검색 결과 없음'이 된다.
  const isRangeReversed =
    isCustomPeriod && listParams.from !== '' && listParams.to !== '' && listParams.to < listParams.from;
  const isListShown = historiesQuery.isSuccess;
  const isPageOutOfRange = isListShown && !historiesQuery.isPlaceholderData && page > Math.max(totalPages, 1);

  // 주소에 없는 페이지(예: ?page=1e3)가 들어오면 1페이지로 돌린다. 개발 판단(PRD에 없음).
  useEffect(() => {
    if (isPageOutOfRange) void setSearchParams({ page: null });
  }, [isPageOutOfRange, setSearchParams]);

  /** 조건을 바꾸면 1페이지로 간다(PRD 4.4). */
  const handleChangeCondition = (condition: HistorySearchCondition) =>
    void setSearchParams({ ...condition, page: null });
  /** 기간 전체로 바꾸면 날짜 칸을 비우고 숨긴다. 직접 입력으로 바꾸면 빈 날짜 칸으로 시작한다(PRD 7.12). */
  const handleChangePeriod = (period: HistoryPeriod) => {
    if (period === listParams.period) return;
    handleChangeCondition({ period: period === 'all' ? null : period, from: null, to: null });
  };
  /** 날짜는 칸에 넣은 그대로 조건에 쓴다. 확정: 한쪽만 넣으면 넣은 쪽만 적용하고, 비운 쪽 끝은 제한하지 않는다. */
  const handleChangeDate = (key: 'from' | 'to', value: string) => handleChangeCondition({ [key]: value || null });
  /** 기간·행위자·대상 종류를 처음 값으로 되돌린다. 사라지는 버튼 대신 기간 칸에 초점을 둔다. */
  const handleResetFilters = () => {
    periodTriggerRef.current?.focus({ preventScroll: true });
    handleChangeCondition({ period: null, from: null, to: null, actor: null, targetType: null });
  };
  const handleRetry = () => {
    periodTriggerRef.current?.focus({ preventScroll: true });
    void historiesQuery.refetch();
  };
  const handleChangePage = (nextPage: number) => {
    if (historiesQuery.isPlaceholderData || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void setSearchParams({ page: nextPage === 1 ? null : nextPage });
  };

  // 역할이 바뀐 뒤 서버가 거부하면 권한 없음 화면(PRD 4.5).
  if (isForbiddenError(historiesQuery.error)) return <Forbidden title={PAGES.history.title} />;

  return (
    <>
      <title>{formatDocumentTitle(PAGES.history.title)}</title>
      <h1 className='text-kd-title-1'>{PAGES.history.title}</h1>
      <Card className='mt-6' aria-busy={historiesQuery.isFetching}>
        <div className='flex flex-wrap items-start gap-2 p-4'>
          <Select value={listParams.period} onValueChange={(value) => handleChangePeriod(value as HistoryPeriod)}>
            <SelectTrigger ref={periodTriggerRef} aria-label='기간' className='w-36'>
              <SelectValue>{PERIOD_LABELS[listParams.period]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCustomPeriod && (
            <div className='flex items-start gap-2 max-[767px]:w-full'>
              <Input
                type='date'
                aria-label='시작일'
                className='w-40 max-[767px]:flex-1'
                value={listParams.from}
                onChange={(event) => handleChangeDate('from', event.target.value)}
              />
              <span aria-hidden className='flex h-kd-control items-center text-kd-foreground-muted'>
                ~
              </span>
              <Field invalid={isRangeReversed} className='w-40 max-[767px]:flex-1'>
                <Input
                  type='date'
                  aria-label='종료일'
                  min={listParams.from || undefined}
                  value={listParams.to}
                  onChange={(event) => handleChangeDate('to', event.target.value)}
                />
                <FieldError className='break-keep'>{isRangeReversed ? RANGE_REVERSED_ERROR : null}</FieldError>
              </Field>
            </div>
          )}
          <Select value={listParams.actor} onValueChange={(value) => handleChangeCondition({ actor: value })}>
            <SelectTrigger ref={actorTriggerRef} aria-label='행위자' className='w-52'>
              <SelectValue>
                {actorsQuery.isPending ? '행위자 불러오는 중…' : listParams.actor === 'all' ? '행위자 전체' : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {actorsQuery.data?.map((actor) => (
                <SelectItem key={actor.email} value={actor.email}>
                  {formatProfileName(actor)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {actorsQuery.isError && (
            <div className='flex items-center gap-2'>
              <p role='status' className='text-kd-sub text-kd-foreground-muted'>
                행위자를 불러오지 못했습니다.
              </p>
              <Button
                variant='link'
                onClick={() => {
                  actorTriggerRef.current?.focus({ preventScroll: true });
                  void actorsQuery.refetch();
                }}
              >
                행위자 다시 시도
              </Button>
            </div>
          )}
          <Select
            value={listParams.targetType}
            onValueChange={(value) => handleChangeCondition({ targetType: value as HistoryListParams['targetType'] })}
          >
            <SelectTrigger aria-label='대상 종류' className='w-40'>
              <SelectValue>
                {listParams.targetType === 'all' ? '대상 종류 전체' : HISTORY_TARGET_TYPE_LABELS[listParams.targetType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {HISTORY_TARGET_TYPES.map((targetType) => (
                <SelectItem key={targetType} value={targetType}>
                  {HISTORY_TARGET_TYPE_LABELS[targetType]}
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
            <p
              role='status'
              className='ml-auto flex h-kd-control items-center text-kd-sub text-kd-foreground-muted tabular-nums'
            >
              {historiesQuery.isPlaceholderData ? '조회 중…' : `총 ${historiesQuery.data.totalElements}건`}
            </p>
          )}
        </div>
        {historiesQuery.isPending ? (
          <ListState kind='loading' />
        ) : historiesQuery.isError ? (
          <ListState kind='error' onAction={handleRetry} />
        ) : (historiesQuery.isPlaceholderData || isPageOutOfRange) && records.length === 0 ? (
          <p
            role='status'
            className='flex min-h-48 items-center justify-center px-4 py-14 text-center text-kd-foreground-muted'
          >
            조건에 맞는 기록을 조회하고 있습니다.
          </p>
        ) : records.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table scrollLabel='변경 이력 가로 스크롤'>
              <caption className='sr-only'>변경 이력</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-kd-col-time' sort='descending'>
                    시각
                  </TableHead>
                  <TableHead>행위자</TableHead>
                  <TableHead>대상 종류</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead>변경 내용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} data-history-id={record.id}>
                    <TableCell className='tabular-nums'>{formatDate(record.occurredAt, true)}</TableCell>
                    <TableCell>
                      <p className='font-semibold'>{formatProfileName(record.actor)}</p>
                      <p className='text-kd-caption text-kd-foreground-muted'>{record.actor.email}</p>
                    </TableCell>
                    <TableCell>{HISTORY_TARGET_TYPE_LABELS[record.target.type]}</TableCell>
                    <TableCell className='max-w-96 min-w-60 whitespace-normal [overflow-wrap:anywhere]'>
                      {formatHistoryTarget(record.target)}
                    </TableCell>
                    <TableCell>
                      <span className='font-semibold'>{HISTORY_ACTION_LABELS[record.action]}</span>
                      {record.change && (
                        <span className='ml-2 text-kd-foreground-muted'>{formatHistoryChange(record.change)}</span>
                      )}
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
                      aria-disabled={page <= 1 || historiesQuery.isPlaceholderData}
                      onClick={() => handleChangePage(page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        isActive={pageNumber === page}
                        className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                        aria-disabled={historiesQuery.isPlaceholderData}
                        onClick={() => handleChangePage(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      className='aria-disabled:cursor-not-allowed aria-disabled:text-kd-neutral-400'
                      aria-disabled={page >= totalPages || historiesQuery.isPlaceholderData}
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
