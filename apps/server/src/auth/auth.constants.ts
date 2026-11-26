export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');

export const SESSION_COOKIE = 'session';
/** 마지막 사용에서 이 시간이 지나면 세션이 만료된다(FR-BO-012). */
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
/** 요청마다 DB를 고치지 않도록, 마지막 사용 시각은 이 간격이 지났을 때만 갱신한다. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

/** 세션 쿠키의 SameSite. 웹과 서버가 다른 사이트(localhost → 개발 서버)이면 `none`이어야 쿠키가 붙는다. */
export type CookieSameSite = 'lax' | 'none';

export interface AuthConfig {
  googleClientId: string;
  /** 쓰기 요청의 Origin 검사와 CORS 허용에 같이 쓴다. */
  allowedOrigins: string[];
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
  devLoginEnabled: boolean;
}
