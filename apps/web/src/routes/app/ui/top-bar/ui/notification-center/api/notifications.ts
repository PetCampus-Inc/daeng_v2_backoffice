import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { Notification } from '../type/notification';

export const notificationsQueryOptions = (email: string) =>
  queryOptions({
    queryKey: ['notifications', email],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<ApiResponse<Notification[]>>('/notifications', { signal });
      return response.data.data;
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

/** 서버가 반환한 개인별 목록으로 건수와 항목을 함께 갱신한다. */
export async function patchNotificationsRead(id?: string) {
  const response = await apiClient.patch<ApiResponse<Notification[]>>(
    id ? `/notifications/${encodeURIComponent(id)}/read` : '/notifications/read-all'
  );
  return response.data.data;
}
