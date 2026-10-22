/**
 * 로그인·세션 오류 응답의 `code`. 서버 스펙이 없어 가정한 값이다. 서버 확인 필요.
 * - unauthorized: 세션 쿠키가 없다(로그인한 적 없음)
 * - sessionExpired: 마지막 요청 뒤 24시간이 지나 세션이 끝났다(PRD 4.5)
 * - accountInactive: 비활성화·등록 취소로 서버가 세션을 지웠다(FR-BO-014)
 * - loginNotAllowed: 미등록·비활성·등록 취소 계정의 로그인 시도(PRD 7.1)
 */
export const AUTH_ERROR_CODES = {
  unauthorized: 'UNAUTHORIZED',
  sessionExpired: 'SESSION_EXPIRED',
  accountInactive: 'ACCOUNT_INACTIVE',
  loginNotAllowed: 'LOGIN_NOT_ALLOWED',
} as const;

/** 구글 로그인 요청. `credential`은 구글이 준 ID 토큰이다. */
export type GoogleLoginInput = {
  credential: string;
};
