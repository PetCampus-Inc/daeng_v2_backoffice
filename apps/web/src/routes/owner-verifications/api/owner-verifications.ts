import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { OwnerVerification, OwnerVerificationListParams } from '../type/owner-verification';

/** 원장 인증 목록 조회 옵션. 관리자 API 확정 전 mock과 공유하는 계약이며 page는 0부터 시작한다. */
export const ownerVerificationsQueryOptions = (email: string, params: OwnerVerificationListParams, page: number) =>
  queryOptions({
    queryKey: ['owner-verifications', email, 'list', params, page],
    // 조건 전환 중에도 표를 유지한다. 계정이 바뀌면 이전 계정의 목록은 표시하지 않는다.
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PageResponse<OwnerVerification>>>('/owner-verifications', {
        params: {
          keyword: params.keyword.trim() || undefined,
          status: params.status === 'all' ? undefined : params.status,
          sort: params.sort,
          page,
          size: 20,
        },
      });
      return response.data.data;
    },
  });
