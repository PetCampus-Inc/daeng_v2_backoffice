import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { MyAccount, UpdateMyAccountInput } from '@/type/account';

/** 개발용 가짜 서버가 현재 계정을 구분할 때만 쓰는 헤더. 실제 서버 요청에는 보내지 않는다. */
function getDevAccountHeaders(email: string) {
  return import.meta.env.DEV ? { 'X-Dev-Email': email } : undefined;
}

/** 로그인한 팀원의 내 계정 정보를 조회한다. */
async function getMyAccount(email: string) {
  const response = await apiClient.get<ApiResponse<MyAccount>>('/me', { headers: getDevAccountHeaders(email) });
  return response.data.data;
}

/** 내 계정 조회 옵션. 로그인 계정별로 캐시를 나눈다. */
export function myAccountQueryOptions(email: string) {
  return queryOptions({ queryKey: ['my-account', email], queryFn: () => getMyAccount(email) });
}

/** 표시명과 직무를 저장한다. 표시명 중복은 서버가 이 요청 시점에 검사한다. */
async function patchMyAccount(email: string, input: UpdateMyAccountInput) {
  const response = await apiClient.patch<ApiResponse<MyAccount>>('/me', input, {
    headers: getDevAccountHeaders(email),
  });
  return response.data.data;
}

/** 내 계정을 저장하고 성공 응답으로 조회 캐시를 즉시 바꾼다. */
export function useUpdateMyAccount(email: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMyAccountInput) => patchMyAccount(email, input),
    onSuccess: (account) => queryClient.setQueryData(myAccountQueryOptions(email).queryKey, account),
  });
}
