import { queryOptions } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { HistoryActor, HistoryListParams, HistoryRecord } from '../type/history';

/** 변경 이력 한 페이지 크기(PRD 7.12). */
export const HISTORY_PAGE_SIZE = 20;

/** 목록 조건을 서버 쿼리로 바꾼다. 처음 값은 보내지 않고, 기간 전체면 날짜를 보내지 않는다. */
const toListQuery = (params: HistoryListParams) => ({
  from: params.period === 'custom' && params.from ? params.from : undefined,
  to: params.period === 'custom' && params.to ? params.to : undefined,
  actorEmail: params.actor === 'all' ? undefined : params.actor,
  targetType: params.targetType === 'all' ? undefined : params.targetType,
});

/** 변경 이력 한 페이지를 최신순으로 조회한다. page는 0부터. */
const getHistories = async (params: HistoryListParams, page: number) => {
  const response = await apiClient.get<ApiResponse<PageResponse<HistoryRecord>>>('/change-histories', {
    params: { ...toListQuery(params), page, size: HISTORY_PAGE_SIZE },
  });
  return response.data.data;
};

/** 역할 때문에 거부된 요청(403)인지. 다시 보내도 같으므로 재시도하지 않고 바로 권한 없음 화면을 보여 준다. */
export const isForbiddenError = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 403;

/** 403은 재시도하지 않고, 그 밖의 실패는 기본값처럼 3번까지 다시 시도한다. */
const retryUnlessForbidden = (failureCount: number, error: unknown) => !isForbiddenError(error) && failureCount < 3;

/** 로그인 계정·조건별 변경 이력 조회 옵션. 조건을 바꾸는 동안 같은 계정의 이전 결과를 남겨 깜빡이지 않게 한다. */
export const historiesQueryOptions = (email: string, params: HistoryListParams, page: number) =>
  queryOptions({
    queryKey: ['change-histories', email, 'list', params, page],
    queryFn: () => getHistories(params, page),
    retry: retryUnlessForbidden,
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
  });

/** 행위자 필터 선택지를 조회한다. */
const getHistoryActors = async () => {
  const response = await apiClient.get<ApiResponse<HistoryActor[]>>('/change-histories/actors', {});
  return response.data.data;
};

/** 행위자 필터 선택지 조회 옵션. */
export const historyActorsQueryOptions = (email: string) =>
  queryOptions({
    queryKey: ['change-histories', email, 'actors'],
    queryFn: () => getHistoryActors(),
    retry: retryUnlessForbidden,
  });
