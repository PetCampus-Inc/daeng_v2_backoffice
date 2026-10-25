export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');

export const SESSION_COOKIE = 'session';
/** 마지막 사용에서 이 시간이 지나면 세션이 만료된다(FR-BO-012). */
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
/** 요청마다 DB를 고치지 않도록, 마지막 사용 시각은 이 간격이 지났을 때만 갱신한다. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export interface AuthConfig {
  googleClientId: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
}
