import { useMutation } from '@tanstack/react-query';

import { getMyAccount } from '@/api/account';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import type { MyAccount } from '@/type/account';
import type { ApiResponse } from '@/type/api';
import type { GoogleLoginInput } from '@/type/auth';

/**
 * 라우터 최상위 loader. 앱을 열고 처음 한 번만 서버에 세션을 묻는다(PRD 3.1 '로그인되어 있나').
 * 401은 apiClient 인터셉터가 guest·만료·비활성으로 나눠 기록한다. 그 밖의 실패(네트워크·500)는 세션이 없는 것으로 본다.
 */
export async function loadSession() {
  if (useAuthStore.getState().status !== 'unknown') return null;
  try {
    useAuthStore.getState().signIn(await getMyAccount());
  } catch {
    if (useAuthStore.getState().status === 'unknown') useAuthStore.getState().markGuest();
  }
  return null;
}

/** 구글이 준 ID 토큰을 서버에 보내 로그인한다. 서버가 토큰 확인·로그인 판정·세션 발급을 한다(OQ-D4 B안). */
async function postGoogleLogin(input: GoogleLoginInput) {
  const response = await apiClient.post<ApiResponse<MyAccount>>('/auth/google', input);
  return response.data.data;
}

/** 구글 로그인. 성공하면 세션을 채우고, 실패 안내는 화면이 오류 응답을 보고 정한다. */
export function useGoogleLogin() {
  const signIn = useAuthStore((state) => state.signIn);
  return useMutation({
    mutationFn: (credential: string) => postGoogleLogin({ credential }),
    onSuccess: signIn,
  });
}

/** 서버 세션을 지운다. 로그아웃은 서버가 접속 기록에 남긴다. */
async function postLogout() {
  await apiClient.post('/auth/logout');
}

/** 로그아웃. 성공하면 세션을 끝내 로그인 화면으로 간다(FR-BO-013). */
export function useLogout() {
  const endSession = useAuthStore((state) => state.endSession);
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => endSession(null),
  });
}
