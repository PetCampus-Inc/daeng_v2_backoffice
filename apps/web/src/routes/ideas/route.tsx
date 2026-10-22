import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
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
import { ideasQueryOptions } from './api/ideas';
import { IDEA_USER_TYPE_LABELS, IDEA_USER_TYPES, type IdeaListParams } from './type/idea';
import { useIdeaListSearchParams } from './util/list-search-params';

/** 서비스 운영 > 아이디어 제안 목록(PRD 7.5). 조건은 주소에 두어 상세에서 돌아와도 그대로다. */
export default function IdeasRoute() {
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const navigate = useNavigate();
  const { listParams, page, listSearch, setSearchParams } = useIdeaListSearchParams();
  const ideasQuery = useQuery(ideasQueryOptions(currentEmail, listParams, page - 1));
  const ideas = ideasQuery.data?.items ?? [];
  const totalPages = ideasQuery.data?.totalPages ?? 0;
  const hasCondition = listParams.keyword !== '' || listParams.userType !== 'all';
  const isListShown = ideasQuery.isSuccess && ideas.length > 0;

  /** 검색·필터를 바꾸면 1페이지로 간다(PRD 4.4). */
  const handleChangeCondition = (condition: Partial<IdeaListParams>) =>
    void setSearchParams({ ...condition, page: null });
  /** 검색어와 필터를 처음 값으로 되돌린다. 정렬은 그대로 둔다. */
  const handleResetFilters = () => void setSearchParams({ keyword: null, userType: null, page: null });
  /** 목록 조건을 상세 주소에 이어 붙여 목록 복귀에 쓴다. */
  const handleOpenIdea = (id: number) => navigate({ pathname: `${PAGES.ideas.path}/${id}`, search: listSearch });

  return (
    <>
      <title>{formatDocumentTitle(PAGES.ideas.title)}</title>
      <h1 className='text-kd-title-1'>{PAGES.ideas.title}</h1>
      <Card className='mt-6'>
        <div className='flex flex-wrap items-center gap-2 p-4'>
          <Input
            type='search'
            aria-label='검색'
            placeholder='내용, 사용자 계정'
            className='w-72 max-[767px]:w-full'
            value={listParams.keyword}
            onChange={(event) => handleChangeCondition({ keyword: event.target.value })}
          />
          <Select
            value={listParams.userType}
            onValueChange={(value) => handleChangeCondition({ userType: value as IdeaListParams['userType'] })}
          >
            <SelectTrigger aria-label='사용자 유형' className='w-40'>
              <SelectValue>
                {listParams.userType === 'all' ? '사용자 유형 전체' : IDEA_USER_TYPE_LABELS[listParams.userType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              {IDEA_USER_TYPES.map((userType) => (
                <SelectItem key={userType} value={userType}>
                  {IDEA_USER_TYPE_LABELS[userType]}
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
            <p className='ml-auto text-kd-sub text-kd-foreground-muted tabular-nums'>
              총 {ideasQuery.data.totalElements}건
            </p>
          )}
        </div>
        {ideasQuery.isPending ? (
          <ListState kind='loading' />
        ) : ideasQuery.isError ? (
          <ListState kind='error' onAction={() => void ideasQuery.refetch()} />
        ) : ideas.length === 0 ? (
          hasCondition ? (
            <ListState kind='no-results' onAction={handleResetFilters} />
          ) : (
            <ListState kind='empty' />
          )
        ) : (
          <>
            <Table scrollLabel='제안 목록 가로 스크롤'>
              <caption className='sr-only'>제안 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-kd-col-number'>제안 번호</TableHead>
                  <TableHead>내용</TableHead>
                  <TableHead>사용자</TableHead>
                  <TableHead
                    className='w-kd-col-time'
                    sort={listParams.sort === 'latest' ? 'descending' : 'ascending'}
                    onSort={() => void setSearchParams({ sort: listParams.sort === 'latest' ? 'oldest' : null })}
                  >
                    제출일시
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ideas.map((idea) => (
                  <TableRow key={idea.id} className='cursor-pointer' onClick={() => handleOpenIdea(idea.id)}>
                    <TableCell className='text-kd-foreground-muted tabular-nums'>#{idea.id}</TableCell>
                    <TableCell className='max-w-80'>
                      <button
                        type='button'
                        className='block max-w-full truncate rounded-kd-2 text-left font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenIdea(idea.id);
                        }}
                      >
                        {idea.content.replace(/\s+/g, ' ')}
                      </button>
                    </TableCell>
                    <TableCell>
                      {IDEA_USER_TYPE_LABELS[idea.user.type]} · {idea.user.name}
                    </TableCell>
                    <TableCell className='tabular-nums'>{formatDate(idea.submittedAt, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <Pagination className='border-t border-kd-border p-4'>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious disabled={page <= 1} onClick={() => void setSearchParams({ page: page - 1 })} />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationButton
                        isActive={pageNumber === page}
                        onClick={() => void setSearchParams({ page: pageNumber === 1 ? null : pageNumber })}
                      >
                        {pageNumber}
                      </PaginationButton>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      disabled={page >= totalPages}
                      onClick={() => void setSearchParams({ page: page + 1 })}
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
