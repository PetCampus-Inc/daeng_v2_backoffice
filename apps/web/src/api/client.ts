import axios from 'axios';

import { useAuthStore, type LoginNotice } from '@/store/auth';
import { useLeaveGuardStore } from '@/store/leave-guard';
import type { ApiError } from '@/type/api';
import { AUTH_ERROR_CODES } from '@/type/auth';

/**
 * 관리자 API(`/api/v0/platform-admin`) 공용 axios 인스턴스.
 * 로그인 유지는 서버 세션 쿠키가 맡는다. BO와 API가 같은 도메인이라 쿠키는 브라우저가 알아서 보낸다(OQ-D4).
 */
export const apiClient = axios.create({
  baseURL: '/api/v0/platform-admin',
});

/** 세션이 끝났다는 401 응답의 `code`로 로그인 화면 안내를 고른다. 비활성은 빨간 박스, 그 밖은 만료 안내다. */
function getSessionEndNotice(code: string | undefined): LoginNotice {
  return code === AUTH_ERROR_CODES.accountInactive ? 'denied' : 'expired';
}

/**
 * 401 응답이면 세션을 끝내 로그인 화면으로 보낸다(PRD 4.5 세션 만료, FR-BO-014).
 * - 앱을 열 때 쿠키가 없던 경우(`UNAUTHORIZED`)는 안내 없이 로그인 화면이다
 * - 로그인 전·세션이 이미 끝난 뒤의 401(로그인 요청 등)은 건드리지 않는다
 * 작성 중이던 화면은 세션이 끝나며 사라지고, 이탈 확인창은 띄우지 않는다(R-이탈-08).
 */
apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError<ApiError>(error) && error.response?.status === 401) {
    const { status, markGuest, endSession } = useAuthStore.getState();
    const code = error.response.data?.code;
    if (status === 'unknown' && code === AUTH_ERROR_CODES.unauthorized) markGuest();
    else if (status === 'unknown' || status === 'signedIn') {
      // 이탈 확인을 기다리던 동작(로그아웃 등)도 버린다. 작성 중 화면은 세션이 끝나며 사라진다.
      useLeaveGuardStore.getState().clearPendingAction();
      endSession(getSessionEndNotice(code));
    }
  }
  return Promise.reject(error);
});
