import { queryOptions } from '@tanstack/react-query';
import { getDevAccountHeaders } from '@/api/account';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { Kindergarten, KindergartenListParams } from '../../type/kindergarten';

/** 관리자 API 확정 전 mock과 공유하는 계약. page는 0부터 시작한다. */
export const kindergartensQueryOptions = (email: string, params: KindergartenListParams, page: number) =>
  queryOptions({
    queryKey: ['kindergartens', email, 'list', params, page],
    // 조건 전환 중에도 표를 유지한다. 계정이 바뀌면 이전 계정의 목록은 표시하지 않는다.
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PageResponse<Kindergarten>>>('/kindergartens', {
        headers: getDevAccountHeaders(email),
        params: {
          keyword: params.keyword.trim() || undefined,
          status: params.status === 'all' ? undefined : params.status,
          page,
          size: 20,
        },
      });
      return response.data.data;
    },
  });
