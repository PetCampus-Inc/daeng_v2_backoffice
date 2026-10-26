import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, test } from 'vitest';
import { ApiException } from '../../src/common/api-error.js';
import { toErrorResponse } from '../../src/common/api-exception.filter.js';
import { AUTH_CONFIG_FOR_TEST } from '../support/auth-app.js';
import type { AuthConfig } from '../../src/auth/auth.constants.js';
import { AuthGuard } from '../../src/auth/auth.guard.js';
import type { AuthService } from '../../src/auth/auth.service.js';
import { clearSessionCookie, readCookie, readSessionId, setSessionCookie } from '../../src/auth/cookies.js';
import { ALLOW_INCOMPLETE_PROFILE, IS_PUBLIC } from '../../src/auth/decorators.js';
import { AuthController } from '../../src/auth/auth.controller.js';
import { GoogleIdTokenVerifier } from '../../src/auth/google-id-token-verifier.js';
import { isLoopbackAddress } from '../../src/auth/loopback.js';
import { isProfileCompleted, toMyAccount } from '../../src/auth/my-account.js';
import { OriginGuard } from '../../src/auth/origin.guard.js';
import { generateSessionId, hashSessionId } from '../../src/auth/session-id.js';
import type { MemberRow } from '../../src/database/schema.js';

const config: AuthConfig = AUTH_CONFIG_FOR_TEST;

function context(request: object, handler: object = {}, cls: object = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

const cookies: string[] = [];
const response = { cookie: (name: string) => cookies.push(name), clearCookie: () => undefined };

function member(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: 1,
    email: 'a@example.com',
    googleSubject: 'sub-1',
    googleName: '구글이름',
    displayName: '홍길동',
    jobRole: 'BE',
    role: 'OPERATOR',
    status: 'ACTIVE',
    lastLoginAt: null,
    registeredAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('session id', () => {
  test('is random, long and stored only as a SHA-256 hash', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionId(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionId(a)).toBe(hashSessionId(a));
    expect(hashSessionId(a)).not.toContain(a);
  });
});

describe('cookie parsing', () => {
  test('reads the named cookie only', () => {
    expect(readCookie('a=1; session=abc; b=2', 'session')).toBe('abc');
    expect(readCookie('mysession=abc', 'session')).toBeUndefined();
    expect(readCookie('session=', 'session')).toBeUndefined();
    expect(readCookie(undefined, 'session')).toBeUndefined();
    expect(readSessionId({ method: 'GET', headers: { cookie: 'session=xyz' } })).toBe('xyz');
  });
});

describe('session cookie options', () => {
  const capture = () => {
    const calls: Array<{ name: string; value?: string; options: Record<string, unknown> }> = [];
    return {
      calls,
      response: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => calls.push({ name, value, options }),
        clearCookie: (name: string, options: Record<string, unknown>) => calls.push({ name, options }),
      },
    };
  };

  test.each([true, false])('sets HttpOnly, SameSite=Lax and Secure=%s', (secure) => {
    const { calls, response } = capture();
    setSessionCookie(response, { ...config, cookieSecure: secure }, 'abc');
    clearSessionCookie(response, { ...config, cookieSecure: secure });
    for (const call of calls) {
      expect(call.name).toBe('session');
      expect(call.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure });
    }
    expect(calls[0].options.maxAge).toBe(24 * 60 * 60 * 1000);
  });
});

describe('dev login is limited to the same computer', () => {
  test('recognizes loopback addresses only', () => {
    for (const address of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1'])
      expect(isLoopbackAddress(address)).toBe(true);
    for (const address of [
      undefined,
      '',
      '192.168.0.5',
      '10.0.0.1',
      '::ffff:192.168.0.5',
      '2001:db8::1',
      '128.0.0.1',
      '127.0.0.1.evil',
    ]) {
      expect(isLoopbackAddress(address)).toBe(false);
    }
  });

  test('answers 404 to requests from another computer even when dev login is on', async () => {
    const auth = { devLogin: async () => ({ member: member(), sessionId: 'x' }) } as unknown as AuthService;
    const controller = new AuthController(auth, config);
    const call = (remoteAddress: string) =>
      controller.devLogin(
        { email: 'a@example.com' },
        { method: 'POST', headers: {}, socket: { remoteAddress } },
        response
      );

    const refused = await call('192.168.0.5').catch((e: unknown) => e);
    expect(toErrorResponse(refused)).toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
    await expect(call('127.0.0.1')).resolves.toMatchObject({ email: 'a@example.com' });
  });
});

describe('origin guard', () => {
  const guard = new OriginGuard(config);
  const call = (method: string, origin?: string) =>
    guard.canActivate(context({ method, headers: origin === undefined ? {} : { origin } }));

  test('lets read requests through without checking the origin', () => {
    expect(call('GET')).toBe(true);
    expect(call('get', 'https://evil.example')).toBe(true);
  });

  test('allows write requests only from the allowed origins', () => {
    expect(call('POST', 'http://localhost:5173')).toBe(true);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const origin of [undefined, 'https://evil.example', 'http://localhost:5173/', 'http://localhost:3000']) {
        expect(() => call(method, origin), `${method} ${origin}`).toThrow(ApiException);
      }
    }
    try {
      call('POST', 'https://evil.example');
    } catch (error) {
      expect(toErrorResponse(error)).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
    }
  });
});

describe('google id token verifier', () => {
  const ticket = (payload: object | undefined) => ({ getPayload: () => payload });
  const verifierWith = (result: () => Promise<unknown>) =>
    new GoogleIdTokenVerifier('client-id', { verifyIdToken: result } as never);

  test('returns a lower-cased identity for a verified email', async () => {
    const verifier = verifierWith(async () =>
      ticket({ sub: 's1', email: 'Ab@Example.COM', email_verified: true, name: '이름' })
    );
    await expect(verifier.verify('token')).resolves.toEqual({ subject: 's1', email: 'ab@example.com', name: '이름' });
  });

  test('passes the expected audience to the library', async () => {
    let audience: unknown;
    const verifier = verifierWith(async (options) => {
      audience = (options as { audience: unknown }).audience;
      return ticket({ sub: 's1', email: 'a@example.com', email_verified: true });
    });
    await verifier.verify('token');
    expect(audience).toBe('client-id');
  });

  test('rejects invalid tokens, unverified emails and missing fields as INVALID_ID_TOKEN', async () => {
    const bad = [
      verifierWith(async () => {
        throw new Error('Wrong recipient, payload audience != requiredAudience');
      }),
      verifierWith(async () => ticket({ sub: 's1', email: 'a@example.com', email_verified: false })),
      verifierWith(async () => ticket({ sub: 's1', email_verified: true })),
      verifierWith(async () => ticket({ email: 'a@example.com', email_verified: true })),
      verifierWith(async () => ticket(undefined)),
    ];
    for (const verifier of bad) {
      const error = await verifier.verify('token').catch((e: unknown) => e);
      expect(toErrorResponse(error)).toMatchObject({ status: 401, body: { code: 'INVALID_ID_TOKEN' } });
    }
  });

  test('does not blame the token for the connection errors the real library throws', async () => {
    const shapes = [
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('timeout'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
      }),
      Object.assign(new Error('Request failed'), { response: { status: 503 } }),
      Object.assign(new Error('x'), { code: 'ECONNRESET' }),
    ];
    for (const shape of shapes) {
      const verifier = verifierWith(async () => {
        throw shape;
      });
      const error = await verifier.verify('token').catch((e: unknown) => e);
      expect(toErrorResponse(error).status).toBe(500);
    }
  });

  test('does not blame the token when Google cannot be reached', async () => {
    const verifier = verifierWith(async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND www.googleapis.com'), { code: 'ENOTFOUND' });
    });
    const error = await verifier.verify('token').catch((e: unknown) => e);
    expect(toErrorResponse(error).status).toBe(500);
  });
});

describe('profile completion', () => {
  test('needs both display name and job role', () => {
    expect(isProfileCompleted(member())).toBe(true);
    expect(isProfileCompleted(member({ displayName: null }))).toBe(false);
    expect(isProfileCompleted(member({ jobRole: null }))).toBe(false);
  });

  test('my account falls back to the email when the Google name is unknown', () => {
    expect(toMyAccount(member({ googleName: null })).googleName).toBe('a@example.com');
    expect(toMyAccount(member())).toMatchObject({ id: 1, role: 'OPERATOR', isProfileCompleted: true });
  });
});

describe('auth guard', () => {
  const reflector = new Reflector();
  const handler = () => undefined;
  const authenticated = (m: MemberRow, extended = false) =>
    ({ authenticate: async () => ({ member: m, extended }) }) as unknown as AuthService;
  const guardFor = (service: AuthService) => new AuthGuard(reflector, service, config);
  const request = (cookie?: string) => ({ method: 'GET', headers: cookie ? { cookie } : {} });

  test('lets public handlers through without a session', async () => {
    Reflect.defineMetadata(IS_PUBLIC, true, handler);
    await expect(guardFor(authenticated(member())).canActivate(context(request(), handler))).resolves.toBe(true);
    Reflect.deleteMetadata(IS_PUBLIC, handler);
  });

  test('requires a session cookie', async () => {
    const error = await guardFor(authenticated(member()))
      .canActivate(context(request(), handler))
      .catch((e: unknown) => e);
    expect(toErrorResponse(error)).toMatchObject({ status: 401, body: { code: 'UNAUTHENTICATED' } });
  });

  test('attaches the member and refreshes the cookie when the session was extended', async () => {
    const req: { member?: MemberRow } & ReturnType<typeof request> = request('session=abc');
    cookies.length = 0;
    await expect(guardFor(authenticated(member(), true)).canActivate(context(req, handler))).resolves.toBe(true);
    expect(req.member?.id).toBe(1);
    expect(cookies).toEqual(['session']);
  });

  test('blocks incomplete profiles except on handlers that allow it', async () => {
    const incomplete = member({ displayName: null, jobRole: null });
    const blocked = await guardFor(authenticated(incomplete))
      .canActivate(context(request('session=abc'), handler))
      .catch((e: unknown) => e);
    expect(toErrorResponse(blocked)).toMatchObject({ status: 403, body: { code: 'PROFILE_INCOMPLETE' } });

    Reflect.defineMetadata(ALLOW_INCOMPLETE_PROFILE, true, handler);
    await expect(
      guardFor(authenticated(incomplete)).canActivate(context(request('session=abc'), handler))
    ).resolves.toBe(true);
    Reflect.deleteMetadata(ALLOW_INCOMPLETE_PROFILE, handler);
  });
});
