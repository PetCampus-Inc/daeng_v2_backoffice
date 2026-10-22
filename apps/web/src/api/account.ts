import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { MyAccount, UpdateMyAccountInput } from '@/type/account';

/** 로그인한 팀원의 내 계정 정보를 조회한다. 세션 쿠키로 계정을 구분하며, 세션이 없으면 401이다. */
export async function getMyAccount() {
  const response = await apiClient.get<ApiResponse<MyAccount>>('/me');
  return response.data.data;
}

/** 내 계정 조회 옵션. 로그인 계정별로 캐시를 나눈다. */
export function myAccountQueryOptions(email: string) {
  return queryOptions({ queryKey: ['my-account', email], queryFn: getMyAccount });
}

/** 표시명과 직무를 저장한다. 표시명 중복은 서버가 이 요청 시점에 검사한다. */
async function patchMyAccount(input: UpdateMyAccountInput) {
  const response = await apiClient.patch<ApiResponse<MyAccount>>('/me', input);
  return response.data.data;
}

/** 내 계정을 저장하고 성공 응답으로 조회 캐시를 즉시 바꾼다. */
export function useUpdateMyAccount(email: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchMyAccount,
    onSuccess: (account) => queryClient.setQueryData(myAccountQueryOptions(email).queryKey, account),
  });
}
