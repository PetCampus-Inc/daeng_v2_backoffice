import { useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

/**
 * 목록 조회가 실패해도 같은 계정에서 마지막으로 성공한 결과를 계속 보여 준다.
 * 마지막으로 성공한 쿼리 키와 계정만 기억하고, 결과는 React Query 캐시에서 읽는다.
 * @param query 목록 쿼리 결과
 * @param accountKey 계정 구분 값(이메일). 계정이 바뀌면 이전 결과를 버린다.
 * @param readPrevious 캐시 값을 화면용 값으로 바꿔야 할 때(select를 쓰는 쿼리)만 넘긴다.
 */
export function useRetainedList<T>(
  query: UseQueryResult<T, unknown> & { queryKey: QueryKey },
  accountKey: string,
  readPrevious?: (queryKey: QueryKey) => T | undefined
) {
  const client = useQueryClient();
  const lastSuccess = useRef<{ accountKey: string; queryKey: QueryKey } | undefined>(undefined);
  const { isSuccess, isPlaceholderData, queryKey, isError, isFetching } = query;

  useEffect(() => {
    if (lastSuccess.current?.accountKey !== accountKey) lastSuccess.current = undefined;
    if (isSuccess && !isPlaceholderData) lastSuccess.current = { accountKey, queryKey };
  }, [accountKey, isSuccess, isPlaceholderData, queryKey]);

  const previous = lastSuccess.current?.accountKey === accountKey ? lastSuccess.current.queryKey : undefined;
  const previousData =
    query.data === undefined && previous
      ? readPrevious
        ? readPrevious(previous)
        : client.getQueryData<T>(previous)
      : undefined;
  const data = query.data ?? previousData;
  const hasError = isError && !isFetching;
  const isTransitioning = isPlaceholderData || (isFetching && !isSuccess && data !== undefined);
  return { data, hasError, isTransitioning, isShowingPrevious: data !== undefined && (isTransitioning || hasError) };
}
