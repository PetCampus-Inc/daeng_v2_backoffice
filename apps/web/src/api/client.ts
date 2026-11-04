import axios from 'axios';

import { useAuthStore, type LoginNotice } from '@/store/auth';
import { useLeaveGuardStore } from '@/store/leave-guard';
import type { ApiError } from '@/type/api';
import { UnauthorizedErrorCode } from '@/type/unauthorized-error-code';
import { captureApiError } from '@/util/sentry';

/**
 * 관리자 API(`/api/v0/admin`) 공용 axios 인스턴스.
 * 로그인 유지는 서버 세션 쿠키가 맡는다.
 * `VITE_API_BASE_URL`이 있으면 그 주소로 보내고(화면과 서버 도메인이 다른 배포), 없으면 도메인 없이 보내
 * 화면이 열린 주소와 같은 곳으로 간다(개발 서버의 가짜 API). 다른 도메인이면 쿠키를 보내도록 `withCredentials`를 켠다.
 */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: apiBaseUrl || '/api/v0/admin',
  withCredentials: Boolean(apiBaseUrl),
});

/** 세션이 끝났다는 401 응답의 `code`로 로그인 화면 안내를 고른다. 비활성은 빨간 박스, 그 밖은 만료 안내다. */
function getSessionEndNotice(code: string | undefined): LoginNotice {
  return code === UnauthorizedErrorCode.ACCOUNT_DEACTIVATED ? 'denied' : 'expired';
}

/**
 * 401 응답이면 세션을 끝내 로그인 화면으로 보낸다(PRD 4.5 세션 만료, FR-BO-014).
 * - 앱을 열 때 쿠키가 없던 경우(`UNAUTHENTICATED`)는 안내 없이 로그인 화면이다
 * - 로그인 전·세션이 이미 끝난 뒤의 401(로그인 요청 등)은 건드리지 않는다
 * 작성 중이던 화면은 세션이 끝나며 사라지고, 이탈 확인창은 띄우지 않는다(R-이탈-08).
 */
apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError<ApiError>(error) && error.response?.status === 401) {
    const { status, markGuest, endSession } = useAuthStore.getState();
    const code = error.response.data?.code;
    if (status === 'unknown' && code === UnauthorizedErrorCode.UNAUTHENTICATED) markGuest();
    else if (status === 'unknown' || status === 'signedIn') {
      // 이탈 확인을 기다리던 동작(로그아웃 등)도 버린다. 작성 중 화면은 세션이 끝나며 사라진다.
      useLeaveGuardStore.getState().clearPendingAction();
      endSession(getSessionEndNotice(code));
    }
  }
  captureApiError(error);
  return Promise.reject(error);
});
