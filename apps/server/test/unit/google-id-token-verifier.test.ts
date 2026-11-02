import { createSign, generateKeyPairSync } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { describe, expect, test } from 'vitest';
import { toErrorResponse } from '../../src/common/api-exception.filter.js';
import { GoogleIdTokenVerifier } from '../../src/auth/google-id-token-verifier.js';

// 구글 서버 없이 진짜 검증 라이브러리를 시험한다. 직접 만든 키로 구글 ID 토큰과 같은 모양의 토큰에 서명하고,
// 라이브러리에는 "구글의 공개키는 이것"이라고 우리 공개키를 알려 준다(테스트에서만). 그래서 서명·대상·발급자·만료 검사를
// 우리가 올바르게 쓰고 있는지가 자동으로 확인된다.

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const KID = 'test-key';

const goodKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });

const base64url = (value: object | Buffer) =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url');

function sign(
  payload: object,
  key = goodKeys.privateKey,
  header: object = { alg: 'RS256', typ: 'JWT', kid: KID }
): string {
  const signingInput = `${base64url(header)}.${base64url(payload)}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(key);
  return `${signingInput}.${base64url(signature)}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-sub-1',
    email: 'Member@Example.com',
    email_verified: true,
    name: '홍길동',
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

/** 구글에서 인증서를 받아 오는 부분만 우리 공개키로 바꾼 진짜 라이브러리 */
class StubCertsClient extends OAuth2Client {
  override async getFederatedSignonCertsAsync() {
    const pem = goodKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    return { certs: { [KID]: pem }, format: 'PEM' } as never;
  }
}

const verifier = new GoogleIdTokenVerifier(CLIENT_ID, new StubCertsClient());
const reject = async (token: string) => toErrorResponse(await verifier.verify(token).catch((e: unknown) => e));

describe('Google ID token verification with the real library', () => {
  test('accepts a correctly signed token and lower-cases the email', async () => {
    await expect(verifier.verify(sign(claims()))).resolves.toEqual({
      subject: 'google-sub-1',
      email: 'member@example.com',
      name: '홍길동',
    });
  });

  test('accepts the other issuer spelling Google uses', async () => {
    await expect(verifier.verify(sign(claims({ iss: 'accounts.google.com' })))).resolves.toMatchObject({
      subject: 'google-sub-1',
    });
  });

  test.each([
    ['signed with a different key (forged)', () => sign(claims(), otherKeys.privateKey)],
    ['issued for another client (audience)', () => sign(claims({ aud: 'someone-else.apps.googleusercontent.com' }))],
    ['expired', () => sign(claims({ iat: 1, exp: Math.floor(Date.now() / 1000) - 3600 }))],
    ['issued by someone else', () => sign(claims({ iss: 'https://evil.example' }))],
    ['email not verified', () => sign(claims({ email_verified: false }))],
    ['no email', () => sign(claims({ email: undefined }))],
    ['no subject', () => sign(claims({ sub: undefined }))],
    ['unsigned (alg none)', () => `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims())}.`],
    ['unknown key id', () => sign(claims(), goodKeys.privateKey, { alg: 'RS256', typ: 'JWT', kid: 'unknown' })],
    ['not a token at all', () => 'not.a.token'],
    ['empty', () => ''],
  ])('rejects a token that is %s with 401 INVALID_ID_TOKEN', async (_name, makeToken) => {
    expect(await reject(makeToken())).toMatchObject({ status: 401, body: { code: 'INVALID_ID_TOKEN' } });
  });
});
