import { queryOptions } from '@tanstack/react-query';
import { getDevAccountHeaders } from '@/api/account';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { Member, MemberListParams } from '../../type/member';

/** API 확정 전 MSW 조회 계약. 0부터 시작하는 페이지, 서버에서 가린 연락처만 반환한다. */
export const membersQueryOptions = (email: string, params: MemberListParams, page: number) =>
  queryOptions({
    queryKey: ['members', email, 'list', params, page],
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PageResponse<Member>>>('/members', {
        headers: getDevAccountHeaders(email),
        params: {
          keyword: params.keyword.trim() || undefined,
          type: params.type === 'all' ? undefined : params.type,
          joinedWithin: params.joinedWithin === 'all' ? undefined : params.joinedWithin,
          page,
          size: 20,
        },
      });
      return response.data.data;
    },
  });
