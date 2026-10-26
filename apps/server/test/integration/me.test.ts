import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service.js';
import { members } from '../../src/database/schema.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';

const RUN = `vitest-me-${Date.now()}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
// 표시명은 10자까지이고 팀원끼리 겹칠 수 없어서, 실행마다 다른 짧은 꼬리표를 붙인다.
const TAG = String(Date.now() % 1_000_000);
const nick = (name: string) => `${name}${TAG}`;

describe.skipIf(!hasDatabase)('/me (real database, fake Google)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;

  const call = async (method: 'get' | 'patch', cookie: string | undefined, body?: unknown, origin = ORIGIN) => {
    const response = await fetch(`${baseUrl}/api/v0/admin/me`, {
      method: method.toUpperCase(),
      headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    await expectMatchesSpec(contract, response, { method, path: '/me' });
    return response;
  };
  const signIn = async (name: string) => {
    await database.db.insert(members).values({ email: email(name), role: 'OPERATOR' });
    const response = await fetch(`${baseUrl}/api/v0/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      // 구글 계정 고유 ID는 팀원끼리 겹칠 수 없어서, 다른 테스트 파일과 겹치지 않게 실행 번호를 붙인다.
      body: JSON.stringify({ idToken: `${name}|sub-${RUN}-${name}` }),
    });
    return response.headers
      .getSetCookie()
      .find((c) => c.startsWith('session='))!
      .split(';')[0];
  };

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    ({ app, baseUrl, database } = await startAuthApp(readTestDatabaseConfig(), email));
  });

  afterAll(async () => {
    await deleteTestRun(database, RUN);
    await app?.close();
  });

  test('requires a session', async () => {
    const response = await call('get', undefined);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('UNAUTHENTICATED');
    expect((await call('patch', undefined, { displayName: 'x', jobRole: 'BE' })).status).toBe(401);
  });

  test('a new member sees an incomplete profile, saves it, and then gets through the profile gate', async () => {
    const cookie = await signIn('first');

    const blocked = await fetch(`${baseUrl}/api/v0/admin/probe`, { headers: { cookie } });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('PROFILE_INCOMPLETE');

    const before = await call('get', cookie);
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({
      email: email('first'),
      googleName: '구글 first',
      displayName: null,
      jobRole: null,
      isProfileCompleted: false,
    });

    const saved = await call('patch', cookie, { displayName: nick('첫'), jobRole: 'FULL_STACK' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      displayName: nick('첫'),
      jobRole: 'FULL_STACK',
      isProfileCompleted: true,
    });

    expect(await call('get', cookie).then((r) => r.json())).toMatchObject({ displayName: nick('첫') });
    const allowed = await fetch(`${baseUrl}/api/v0/admin/probe`, { headers: { cookie } });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ ok: true });
  });

  test('trims the display name and lets the owner save the same name again', async () => {
    const cookie = await signIn('trim');
    const first = await call('patch', cookie, { displayName: `  ${nick('공백')}  `, jobRole: 'PM' });
    expect((await first.json()).displayName).toBe(nick('공백'));

    const again = await call('patch', cookie, { displayName: nick('공백'), jobRole: 'BE' });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ displayName: nick('공백'), jobRole: 'BE' });
  });

  test('rejects a display name another member already uses with 409 (case-insensitively)', async () => {
    const owner = await signIn('owner');
    await call('patch', owner, { displayName: nick('kim'), jobRole: 'FE' });

    const other = await signIn('other');
    for (const name of [nick('kim'), nick('KIM')]) {
      const response = await call('patch', other, { displayName: name, jobRole: 'BE' });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('PROFILE_DISPLAY_NAME_DUPLICATE');
    }
    expect(await call('get', other).then((r) => r.json())).toMatchObject({ displayName: null });
  });

  test('validates the body with 400 VALIDATION_FAILED', async () => {
    const cookie = await signIn('invalid');
    const bodies = [
      {},
      { displayName: '', jobRole: 'BE' },
      { displayName: '   ', jobRole: 'BE' },
      { displayName: '열한글자이름입니다만요', jobRole: 'BE' },
      { displayName: nick('ok'), jobRole: 'CEO' },
      { displayName: nick('ok') },
    ];
    for (const body of bodies) {
      const response = await call('patch', cookie, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect((await response.json()).code).toBe('VALIDATION_FAILED');
    }
  });

  test('a write from an unknown Origin is rejected', async () => {
    const cookie = await signIn('origin');
    const response = await fetch(`${baseUrl}/api/v0/admin/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie },
      body: JSON.stringify({ displayName: nick('악'), jobRole: 'BE' }),
    });
    await expectMatchesSpec(contract, response, { method: 'patch', path: '/me' });
    expect(response.status).toBe(403);
    const [row] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('origin')));
    expect(row.displayName).toBeNull();
  });
});
