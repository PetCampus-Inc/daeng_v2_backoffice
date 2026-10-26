import { OAuth2Client } from 'google-auth-library';
import { ApiException } from '../common/api-error.js';

export interface GoogleIdentity {
  /** 구글 계정 고유 ID(sub). 이메일과 달리 바뀌지 않는다. */
  subject: string;
  /** 소문자로 바꾼 이메일 */
  email: string;
  name: string | null;
}

export interface IdTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

const NETWORK_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

/**
 * 구글 서버에 연결하지 못했거나 응답이 이상한 경우는 토큰 탓이 아니라서 401이 아니라 서버 오류로 둔다.
 * 라이브러리는 연결 실패를 `TypeError: fetch failed`(원인은 `cause`)로 던지고, 토큰 검증 실패는 원인 없는 일반 오류로 던진다.
 */
function isInfrastructureError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const { code, response, cause } = error as { code?: unknown; response?: unknown; cause?: unknown };
  return response !== undefined || cause !== undefined || (typeof code === 'string' && NETWORK_ERROR_CODES.has(code));
}

function invalidIdToken(): ApiException {
  return new ApiException(401, 'INVALID_ID_TOKEN', 'ID 토큰을 확인할 수 없습니다.');
}

/** 서명, 발급자, 대상 클라이언트 ID, 만료를 구글 공식 라이브러리로 검증하고 이메일 인증 여부까지 본다. */
export class GoogleIdTokenVerifier implements IdTokenVerifier {
  constructor(
    private readonly clientId: string,
    private readonly client: Pick<OAuth2Client, 'verifyIdToken'> = new OAuth2Client()
  ) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch (error) {
      if (isInfrastructureError(error)) throw error;
      throw invalidIdToken();
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw invalidIdToken();
    return { subject: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? null };
  }
}
