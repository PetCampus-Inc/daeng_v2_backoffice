import { useQueryClient } from '@tanstack/react-query';

import {
  getGetMyAccountQueryKey,
  getMyAccount,
  useLogin,
  useLogout as useLogoutRequest,
  useUpdateMyAccount,
} from '@/api/use-my-account';
import { useAuthStore } from '@/store/auth';
import type { MyAccount } from '@/type/my-account';

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

/** 서버가 준 내 계정으로 내 계정 조회 캐시를 바꾸는 함수. 로그인 계정이 바뀌어도 이전 계정 값이 남지 않게 한다. */
function useSetMyAccountCache() {
  const queryClient = useQueryClient();
  return (account: MyAccount) => queryClient.setQueryData(getGetMyAccountQueryKey(), account);
}

/** 구글 로그인. 성공하면 세션을 채우고, 실패 안내는 화면이 오류 응답을 보고 정한다. */
export function useGoogleLogin() {
  const signIn = useAuthStore((state) => state.signIn);
  const setMyAccountCache = useSetMyAccountCache();
  return useLogin({
    mutation: {
      onSuccess: (account) => {
        setMyAccountCache(account);
        signIn(account);
      },
    },
  });
}

/** 로그아웃. 성공하면 세션을 끝내 로그인 화면으로 간다(FR-BO-013). 서버가 접속 기록에 남긴다. */
export function useLogout() {
  const endSession = useAuthStore((state) => state.endSession);
  return useLogoutRequest({ mutation: { onSuccess: () => endSession(null) } });
}

/** 표시명과 직무 저장. 성공 응답으로 내 계정 조회 캐시를 바로 바꾼다. 표시명 중복은 서버가 요청 시점에 검사한다. */
export function useSaveMyAccount() {
  const setMyAccountCache = useSetMyAccountCache();
  return useUpdateMyAccount({ mutation: { onSuccess: setMyAccountCache } });
}
