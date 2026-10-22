/**
 * 개발용 가짜 구글 ID 토큰. 실제 토큰(JWT) 대신 구글이 확인한 이메일·이름만 담는다.
 * 개발용 계정 고르기가 만들고, 가짜 서버의 로그인 핸들러가 읽는다. 배포 build에는 들어가지 않는다.
 */
const DEV_CREDENTIAL_PREFIX = 'dev-credential:';

export type DevCredentialPayload = {
  email: string;
  name: string;
};

/** 고른 개발용 계정으로 가짜 ID 토큰을 만든다. */
export function createDevCredential(payload: DevCredentialPayload) {
  return `${DEV_CREDENTIAL_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

/** 가짜 ID 토큰을 읽는다. 형식이 맞지 않으면 null(실제 서버의 토큰 검증 실패 자리)이다. */
export function readDevCredential(credential: string): DevCredentialPayload | null {
  if (!credential.startsWith(DEV_CREDENTIAL_PREFIX)) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(credential.slice(DEV_CREDENTIAL_PREFIX.length))) as unknown;
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as DevCredentialPayload).email === 'string' &&
      typeof (payload as DevCredentialPayload).name === 'string'
    ) {
      return payload as DevCredentialPayload;
    }
  } catch {
    // 잘못된 토큰은 아래에서 null로 돌려준다.
  }
  return null;
}
