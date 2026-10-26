import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, max } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { hashSessionId } from '../../src/auth/session-id.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { accessLogs, members, sessions } from '../../src/database/schema.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { toErrorResponse } from '../../src/common/api-exception.filter.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';

const RUN = `vitest-auth-${Date.now()}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
// 표시명은 10자까지이고 팀원끼리 겹칠 수 없어서, 실행마다 겹치지 않는 값을 만든다.
let displayNameSeq = 0;
const displayName = () => `길${Date.now() % 1_000_000}${++displayNameSeq}`;

describe.skipIf(!hasDatabase)('login flow (real database, fake Google)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;

  let contract: OpenApiContract;
  // 로그인·로그아웃의 모든 응답은 명세(openapi.yaml)와 맞아야 한다. 명세에 없는 probe API의 오류 응답은 공통 `Error` 형식과만 대조한다.
  const post = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`${baseUrl}/api/v0/admin${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    await expectMatchesSpec(contract, response, { method: 'post', path });
    return response;
  };
  const probe = async (cookie?: string) => {
    const response = await fetch(`${baseUrl}/api/v0/admin/probe`, { headers: cookie ? { cookie } : {} });
    if (response.status >= 400) expect(contract.checkSchema('Error', await response.clone().json())).toEqual([]);
    return response;
  };
  const login = (name: string, headers: Record<string, string> = {}) => post('/auth/login', { idToken: name }, headers);
  const sessionCookie = (response: Response) => {
    const header = response.headers.getSetCookie().find((c) => c.startsWith('session='));
    return header?.split(';')[0];
  };
  const addMember = (name: string, overrides: Partial<typeof members.$inferInsert> = {}) =>
    database.db.insert(members).values({ email: email(name), role: 'OPERATOR', ...overrides });
  const logsFor = (name: string) =>
    database.db
      .select()
      .from(accessLogs)
      .where(eq(accessLogs.email, email(name)));

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    ({ app, baseUrl, database } = await startAuthApp(readTestDatabaseConfig(), email));
  });

  afterAll(async () => {
    await deleteTestRun(database, RUN);
    await app?.close();
  });

  test('rejects write requests from a missing or unknown Origin before doing anything else', async () => {
    const noOrigin = await fetch(`${baseUrl}/api/v0/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'x' }),
    });
    expect(noOrigin.status).toBe(403);
    await expectMatchesSpec(contract, noOrigin, { method: 'post', path: '/auth/login' });
    expect((await noOrigin.json()).code).toBe('FORBIDDEN');

    const evil = await login('x', { origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
    expect((await evil.json()).code).toBe('FORBIDDEN');
  });

  test('validates the request body', async () => {
    const response = await post('/auth/login', {});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', details: [{ field: 'idToken' }] });
  });

  test('rejects an invalid token with 401 INVALID_ID_TOKEN and logs it without an email', async () => {
    // 이메일이 없는 실패 기록은 이메일로 찾을 수 없다. 시작 전의 마지막 번호를 기억해 그 뒤에 생긴 줄만 확인하고 지운다.
    const [{ lastId }] = await database.db.select({ lastId: max(accessLogs.id) }).from(accessLogs);
    const response = await login('bad-token');
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('INVALID_ID_TOKEN');
    expect(sessionCookie(response)).toBeUndefined();

    const created = await database.db
      .select()
      .from(accessLogs)
      .where(and(gt(accessLogs.id, lastId ?? 0), isNull(accessLogs.email), eq(accessLogs.result, 'INVALID_TOKEN')));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ event: 'LOGIN_FAILURE', email: null });
    await database.db.delete(accessLogs).where(
      inArray(
        accessLogs.id,
        created.map((l) => l.id)
      )
    );
  });

  test('does not create accounts: an unregistered email gets 403 LOGIN_NOT_ALLOWED', async () => {
    const response = await login('stranger');
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('LOGIN_NOT_ALLOWED');
    expect(
      await database.db
        .select()
        .from(members)
        .where(eq(members.email, email('stranger')))
    ).toHaveLength(0);
    expect(await logsFor('stranger')).toMatchObject([{ event: 'LOGIN_FAILURE', result: 'UNREGISTERED' }]);
  });

  test('first login activates the member, links the Google account and sets an HttpOnly cookie', async () => {
    await addMember('first');
    const response = await login('first');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      email: email('first'),
      googleName: '구글 first',
      displayName: null,
      jobRole: null,
      role: 'OPERATOR',
      isProfileCompleted: false,
    });

    const setCookie = response.headers.getSetCookie().find((c) => c.startsWith('session='))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=86400/i);
    expect(setCookie).not.toMatch(/Secure/i); // 테스트 설정은 COOKIE_SECURE=false

    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('first')));
    expect(member).toMatchObject({ status: 'ACTIVE', googleSubject: 'sub-first' });
    expect(member.lastLoginAt).toBeInstanceOf(Date);

    const rawId = setCookie.split(';')[0].slice('session='.length);
    const stored = await database.db.select().from(sessions).where(eq(sessions.memberId, member.id));
    expect(stored).toHaveLength(1);
    expect(stored[0].idHash).toBe(hashSessionId(rawId));
    expect(stored[0].idHash).not.toBe(rawId);
    expect(await logsFor('first')).toMatchObject([{ event: 'LOGIN_SUCCESS', result: 'SUCCESS' }]);
  });

  test('email matching ignores case and a second login keeps the same Google account', async () => {
    await addMember('again');
    expect((await login('again')).status).toBe(200);
    expect((await login('again')).status).toBe(200);
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('again')));
    expect(member.googleSubject).toBe('sub-again');
    expect(await database.db.select().from(sessions).where(eq(sessions.memberId, member.id))).toHaveLength(2);
  });

  test('a different Google account with the same email is rejected', async () => {
    await addMember('reused', { googleSubject: 'original-owner', status: 'ACTIVE' });
    const response = await post('/auth/login', { idToken: 'reused|someone-else' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('LOGIN_NOT_ALLOWED');
    expect((await logsFor('reused'))[0]).toMatchObject({ event: 'LOGIN_FAILURE', result: 'SUBJECT_MISMATCH' });
  });

  test('inactive and cancelled members cannot log in', async () => {
    await addMember('inactive', { status: 'INACTIVE' });
    await addMember('cancelled', { status: 'CANCELLED' });
    for (const [name, result] of [
      ['inactive', 'INACTIVE'],
      ['cancelled', 'CANCELLED'],
    ] as const) {
      const response = await login(name);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('LOGIN_NOT_ALLOWED');
      expect((await logsFor(name))[0]).toMatchObject({ event: 'LOGIN_FAILURE', result });
    }
  });

  test('dev login signs in a registered member without Google and the session works', async () => {
    await addMember('dev', { displayName: displayName(), jobRole: 'BE' });
    const response = await post('/auth/dev-login', { email: email('dev').toUpperCase() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ email: email('dev'), role: 'OPERATOR', isProfileCompleted: true });

    const cookie = sessionCookie(response)!;
    expect(cookie).toBeDefined();
    expect((await probe(cookie)).status).toBe(200);

    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('dev')));
    expect(member).toMatchObject({ status: 'ACTIVE', googleSubject: null });
    expect((await post('/auth/logout', undefined, { cookie })).status).toBe(204);
  });

  test('dev login follows the same rules: unregistered, inactive and cancelled members are refused', async () => {
    await addMember('dev-inactive', { status: 'INACTIVE' });
    await addMember('dev-cancelled', { status: 'CANCELLED' });
    for (const name of ['dev-stranger', 'dev-inactive', 'dev-cancelled']) {
      const response = await post('/auth/dev-login', { email: email(name) });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('LOGIN_NOT_ALLOWED');
      expect(sessionCookie(response)).toBeUndefined();
    }
    expect(
      await database.db
        .select()
        .from(members)
        .where(eq(members.email, email('dev-stranger')))
    ).toHaveLength(0);
  });

  test('logout needs a session, deletes it and clears the cookie', async () => {
    await addMember('leaver');
    const anonymous = await post('/auth/logout');
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).code).toBe('UNAUTHENTICATED');

    const cookie = sessionCookie(await login('leaver'))!;
    const loggedOut = await post('/auth/logout', undefined, { cookie });
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers.getSetCookie().find((c) => c.startsWith('session='))).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect((await logsFor('leaver')).map((l) => l.event).sort()).toEqual(['LOGIN_SUCCESS', 'LOGOUT']);

    const again = await post('/auth/logout', undefined, { cookie });
    expect(again.status).toBe(401);
  });

  test('logout is also protected by the Origin check', async () => {
    await addMember('csrf');
    const cookie = sessionCookie(await login('csrf'))!;
    const response = await post('/auth/logout', undefined, { cookie, origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(await probe(cookie).then((r) => r.status)).toBe(403); // 프로필 미완료라 막히지만 세션은 살아 있다
  });

  test('profile gate: incomplete profiles get 403 PROFILE_INCOMPLETE, completed ones pass', async () => {
    await addMember('gate');
    const cookie = sessionCookie(await login('gate'))!;
    const blocked = await probe(cookie);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('PROFILE_INCOMPLETE');

    await database.db
      .update(members)
      .set({ displayName: displayName(), jobRole: 'BE' })
      .where(eq(members.email, email('gate')));
    const allowed = await probe(cookie);
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ ok: true });
  });

  test('requests without a session cookie get 401 UNAUTHENTICATED', async () => {
    const none = await probe();
    expect(none.status).toBe(401);
    expect((await none.json()).code).toBe('UNAUTHENTICATED');
    const forged = await probe('session=not-a-real-session');
    expect(forged.status).toBe(401);
  });

  test('sessions expire after 24 hours of inactivity and are deleted', async () => {
    await addMember('idle', { displayName: displayName(), jobRole: 'PM' });
    const cookie = sessionCookie(await login('idle'))!;
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('idle')));
    await database.db
      .update(sessions)
      .set({ lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000) })
      .where(eq(sessions.memberId, member.id));

    const response = await probe(cookie);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('SESSION_EXPIRED');
    expect(await database.db.select().from(sessions).where(eq(sessions.memberId, member.id))).toHaveLength(0);
    expect((await logsFor('idle')).map((l) => l.event)).toContain('SESSION_EXPIRED');
    expect((await probe(cookie)).status).toBe(401);
  });

  test('login does not revive a member who was deactivated right after the allow-check', async () => {
    await addMember('race');
    const [allowedBefore] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('race')));
    await database.db
      .update(members)
      .set({ status: 'INACTIVE' })
      .where(eq(members.email, email('race')));

    // 허용 여부를 확인한 시점의 낡은 정보를 돌려줘서, 확인과 갱신 사이에 비활성화된 상황을 만든다
    const service = app.get(AuthService);
    vi.spyOn(
      service as unknown as { findAllowedMember: () => Promise<unknown> },
      'findAllowedMember'
    ).mockResolvedValueOnce(allowedBefore);
    const error = await service.devLogin(email('race')).catch((e: unknown) => e);

    expect(toErrorResponse(error)).toMatchObject({ status: 403, body: { code: 'LOGIN_NOT_ALLOWED' } });
    const [after] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('race')));
    expect(after.status).toBe('INACTIVE');
    expect(await database.db.select().from(sessions).where(eq(sessions.memberId, after.id))).toHaveLength(0);
    expect(await logsFor('race')).toMatchObject([{ event: 'LOGIN_FAILURE', result: 'INACTIVE' }]);
  });

  test("logging in removes that member's expired sessions but keeps the active ones", async () => {
    await addMember('cleanup');
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('cleanup')));
    const hour = 60 * 60 * 1000;
    await database.db.insert(sessions).values([
      { idHash: hashSessionId('expired-one'), memberId: member.id, lastUsedAt: new Date(Date.now() - 25 * hour) },
      { idHash: hashSessionId('still-active'), memberId: member.id, lastUsedAt: new Date(Date.now() - hour) },
    ]);

    expect((await login('cleanup')).status).toBe(200);
    const rows = await database.db.select().from(sessions).where(eq(sessions.memberId, member.id));
    expect(rows.map((r) => r.idHash)).not.toContain(hashSessionId('expired-one'));
    expect(rows.map((r) => r.idHash)).toContain(hashSessionId('still-active'));
    expect(rows).toHaveLength(2);
  });

  test('requests within a minute do not touch the session or the cookie', async () => {
    await addMember('quiet', { displayName: displayName(), jobRole: 'PM' });
    const cookie = sessionCookie(await login('quiet'))!;
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('quiet')));
    const recent = new Date(Date.now() - 30 * 1000);
    await database.db.update(sessions).set({ lastUsedAt: recent }).where(eq(sessions.memberId, member.id));

    const response = await probe(cookie);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().find((c) => c.startsWith('session='))).toBeUndefined();
    const [row] = await database.db.select().from(sessions).where(eq(sessions.memberId, member.id));
    expect(row.lastUsedAt.getTime()).toBe(recent.getTime());
  });

  test('each request extends the session and refreshes the cookie', async () => {
    await addMember('active', { displayName: displayName(), jobRole: 'FE' });
    const cookie = sessionCookie(await login('active'))!;
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('active')));
    const old = new Date(Date.now() - 2 * 60 * 1000);
    await database.db.update(sessions).set({ lastUsedAt: old }).where(eq(sessions.memberId, member.id));

    const response = await probe(cookie);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().find((c) => c.startsWith('session='))).toMatch(/Max-Age=86400/i);
    const [row] = await database.db.select().from(sessions).where(eq(sessions.memberId, member.id));
    expect(row.lastUsedAt.getTime()).toBeGreaterThan(old.getTime() + 60 * 1000);
  });

  test('deactivating a member ends their session immediately', async () => {
    await addMember('fired', { displayName: displayName(), jobRole: 'BE' });
    const cookie = sessionCookie(await login('fired'))!;
    expect((await probe(cookie)).status).toBe(200);

    await database.db
      .update(members)
      .set({ status: 'INACTIVE' })
      .where(eq(members.email, email('fired')));
    const response = await probe(cookie);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('ACCOUNT_DEACTIVATED');
    const [member] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('fired')));
    expect(await database.db.select().from(sessions).where(eq(sessions.memberId, member.id))).toHaveLength(0);
  });
});
