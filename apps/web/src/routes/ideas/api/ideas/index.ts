import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { Idea, IdeaListParams } from '../../type/idea';

/** 제안 목록은 20건씩 조회한다. page는 0부터 시작한다. */
export const ideasQueryOptions = (email: string, params: IdeaListParams, page: number) =>
  queryOptions({
    queryKey: ['ideas', email, 'list', params, page],
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PageResponse<Idea>>>('/ideas', {
        params: {
          keyword: params.keyword || undefined,
          userType: params.userType === 'all' ? undefined : params.userType,
          sort: params.sort,
          page,
          size: 20,
        },
      });
      return response.data.data;
    },
  });

export const ideaQueryOptions = (email: string, id: number) =>
  queryOptions({
    queryKey: ['ideas', email, 'detail', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Idea>>(`/ideas/${id}`);
      return response.data.data;
    },
    retry: false,
  });
