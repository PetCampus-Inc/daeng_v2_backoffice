export function readGoogleClientId(value: string | undefined): string {
  if (value === undefined || value.trim() === '') throw new Error('GOOGLE_CLIENT_ID is required');
  return value.trim();
}

/** 쉼표로 구분한 웹 주소 목록. 각 항목은 경로 없이 `scheme://host[:port]` 형식이어야 한다. */
export function readAllowedOrigins(value: string | undefined): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length === 0) throw new Error('ALLOWED_ORIGINS must list at least one origin');
  for (const item of items) {
    let origin: string | undefined;
    try {
      const url = new URL(item);
      origin = ['http:', 'https:'].includes(url.protocol) ? url.origin : undefined;
    } catch {
      origin = undefined;
    }
    if (origin !== item) {
      throw new Error(
        'ALLOWED_ORIGINS must be comma-separated origins like http://localhost:5173 (no path or trailing slash)'
      );
    }
  }
  return items;
}

/** 값이 없으면 안전한 쪽(true)이다. HTTPS가 아닌 로컬에서는 `false`로 둔다. */
export function readCookieSecure(value: string | undefined): boolean {
  if (value === undefined || value === '') return true;
  if (value !== 'true' && value !== 'false') throw new Error('COOKIE_SECURE must be "true" or "false"');
  return value === 'true';
}

/**
 * 개발용 로그인(구글 검증 없이 이메일로 로그인)을 켤지 정한다. 기본은 꺼짐이다.
 * 운영에서 실수로 켜져 인증이 뚫리는 것을 막으려고, 쿠키 `Secure`가 켜진 설정(운영)에서는 켜면 서버가 시작하지 않는다.
 */
export function readDevLoginEnabled(value: string | undefined, cookieSecure: boolean): boolean {
  if (value === undefined || value === '') return false;
  if (value !== 'true' && value !== 'false') throw new Error('DEV_LOGIN_ENABLED must be "true" or "false"');
  if (value === 'true' && cookieSecure) {
    throw new Error('DEV_LOGIN_ENABLED=true is only allowed with COOKIE_SECURE=false (local development)');
  }
  return value === 'true';
}
