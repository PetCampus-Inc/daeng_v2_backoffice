import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type { Notice, NoticeAction, NoticeInput, NoticeListParams } from '../../type/notice';

export const noticesQueryOptions = (email: string, params: NoticeListParams, page: number) =>
  queryOptions({
    queryKey: ['notices', email, 'list', params, page],
    // 미방문 조건도 같은 계정의 직전 표를 유지한다. 계정 전환에는 이전 결과를 노출하지 않는다.
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PageResponse<Notice>>>('/notices', {
        params: {
          keyword: params.keyword || undefined,
          status: params.status === 'all' ? undefined : params.status,
          page,
          size: 20,
        },
      });
      return response.data.data;
    },
  });

export const noticeQueryOptions = (email: string, id: number) =>
  queryOptions({
    queryKey: ['notices', email, 'detail', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Notice>>(`/notices/${id}`);
      return response.data.data;
    },
    retry: false,
  });

type NoticeMutationInput = {
  id?: number;
  revision?: number;
  action: NoticeAction | 'delete';
  input?: NoticeInput;
};

async function postNotice({ action, input }: NoticeMutationInput) {
  const response = await apiClient.post<ApiResponse<Notice>>('/notices', { ...input, action });
  return response.data.data;
}

async function patchNotice({ id, revision, action, input }: NoticeMutationInput) {
  const response = await apiClient.patch<ApiResponse<Notice>>(`/notices/${id}`, { ...input, revision, action });
  return response.data.data;
}

async function deleteNotice({ id, revision }: NoticeMutationInput) {
  await apiClient.delete(`/notices/${id}`, { data: { revision } });
  return null;
}

function changeNotice(input: NoticeMutationInput) {
  if (input.action === 'delete') return deleteNotice(input);
  return input.id === undefined ? postNotice(input) : patchNotice(input);
}

export function useChangeNotice(email: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['notices', email, 'change'],
    mutationFn: (input: NoticeMutationInput) => changeNotice(input),
    onSuccess: (notice, variables) => {
      if (notice) queryClient.setQueryData(noticeQueryOptions(email, notice.id).queryKey, notice);
      else queryClient.removeQueries({ queryKey: noticeQueryOptions(email, variables.id!).queryKey });
      void queryClient.invalidateQueries({ queryKey: ['notices', email, 'list'] });
    },
  });
}
