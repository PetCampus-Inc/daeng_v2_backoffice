import * as Sentry from '@sentry/react';
import axios from 'axios';

/**
 * Sentry를 켠다. 배포 build이면서 DSN이 있을 때만 켠다.
 * 개발 서버에서는 켜지 않아 로컬 에러가 쌓이지 않는다. 에러만 모으고 트레이싱·리플레이는 쓰지 않는다.
 * 릴리스 이름은 sentryVitePlugin이 build 때 번들에 넣어 주므로 따로 받지 않는다.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // 고객 정보가 오가는 백오피스라 사용자 정보·쿠키·헤더·요청 본문·URL 쿼리는 보내지 않는다.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

/**
 * API 에러 중 서버·네트워크 문제만 Sentry로 보낸다.
 * 401·403·404·400 같은 4xx는 정상 흐름이라 보내지 않는다. 요청을 직접 취소한 경우도 제외한다.
 */
export function captureApiError(error: unknown) {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return;
  const isNetworkError = error.response === undefined;
  const isServerError = (error.response?.status ?? 0) >= 500;
  if (isNetworkError || isServerError) Sentry.captureException(error);
}
