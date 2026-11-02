import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AUTH_CONFIG_FOR_TEST, ORIGIN, startAuthApp, UNUSED_DATABASE, type AuthTestApp } from '../support/auth-app.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';

// DB 없이 돌아가는 명세 일치 검사: 인증·검증·Origin 오류 응답이 명세에 적힌 모양과 맞는지 확인한다.
// 성공 응답과 DB가 필요한 응답은 auth-flow.test.ts에서 같은 방식으로 확인한다.
describe('auth error responses match the OpenAPI spec (no database needed)', () => {
  let contract: OpenApiContract;
  let server: AuthTestApp;

  const send = (path: string, init: { headers?: Record<string, string>; body?: unknown } = {}) =>
    fetch(`${server.baseUrl}/api/v0/admin${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    server = await startAuthApp(UNUSED_DATABASE, (name) => `${name}@example.com`);
  });

  afterAll(async () => {
    await server?.app.close();
  });

  test('login without a valid Origin is 403 FORBIDDEN', async () => {
    for (const headers of [{}, { origin: 'https://evil.example' }]) {
      const response = await send('/auth/login', { headers, body: { idToken: 'x' } });
      expect(response.status).toBe(403);
      await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/login' });
      expect((await response.json()).code).toBe('FORBIDDEN');
    }
  });

  test('login with a malformed body is 400 VALIDATION_FAILED with field details', async () => {
    const response = await send('/auth/login', { headers: { origin: ORIGIN }, body: {} });
    expect(response.status).toBe(400);
    await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/login' });
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', details: [{ field: 'idToken' }] });
  });

  test('login with an invalid Google token is 401 INVALID_ID_TOKEN', async () => {
    // 가짜 검증기가 DB 조회 전에 거부하지만, 접속 기록 쓰기는 DB가 없으면 실패해도 로그인 응답에는 영향이 없다.
    const response = await send('/auth/login', { headers: { origin: ORIGIN }, body: { idToken: 'bad-token' } });
    expect(response.status).toBe(401);
    await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/login' });
    expect((await response.json()).code).toBe('INVALID_ID_TOKEN');
  });

  test('logout without a session is 401 and without a valid Origin is 403', async () => {
    const anonymous = await send('/auth/logout', { headers: { origin: ORIGIN } });
    expect(anonymous.status).toBe(401);
    await expectMatchesSpec(contract, anonymous, { method: 'post', path: '/auth/logout' });
    expect((await anonymous.json()).code).toBe('UNAUTHENTICATED');

    const crossSite = await send('/auth/logout', {
      headers: { origin: 'https://evil.example', cookie: 'session=abc' },
    });
    expect(crossSite.status).toBe(403);
    await expectMatchesSpec(contract, crossSite, { method: 'post', path: '/auth/logout' });
  });

  test('unknown routes use the common error shape from the spec', async () => {
    const response = await fetch(`${server.baseUrl}/no-such-path`);
    expect(response.status).toBe(404);
    expect(contract.checkSchema('Error', await response.json())).toEqual([]);
  });

  test('dev login validates its body and matches the spec', async () => {
    const response = await send('/auth/dev-login', { headers: { origin: ORIGIN }, body: { email: 'not-an-email' } });
    expect(response.status).toBe(400);
    await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/dev-login' });
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', details: [{ field: 'email' }] });
  });

  test('dev login without a valid Origin is 403 FORBIDDEN', async () => {
    const response = await send('/auth/dev-login', { body: { email: 'a@example.com' } });
    expect(response.status).toBe(403);
    await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/dev-login' });
  });

  test('dev login is a plain 404 when it is switched off, even for invalid bodies', async () => {
    const off = await startAuthApp(UNUSED_DATABASE, (name) => `${name}@example.com`, {
      ...AUTH_CONFIG_FOR_TEST,
      devLoginEnabled: false,
    });
    try {
      for (const body of [{ email: 'a@example.com' }, {}]) {
        const response = await fetch(`${off.baseUrl}/api/v0/admin/auth/dev-login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(404);
        await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/dev-login' });
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    } finally {
      await off.app.close();
    }
  });
});
