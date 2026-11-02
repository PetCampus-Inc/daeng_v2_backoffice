import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service.js';
import { accessLogs, changeLogs, members, type MemberRole, type MemberStatus } from '../../src/database/schema.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';

const RUN = `vitest-team-${Date.now()}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
let nameSeq = 0;
const displayName = () => `팀${Date.now() % 1_000_000}${++nameSeq}`;

describe.skipIf(!hasDatabase)('team member management (real database, fake Google)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;
  let actorId: number;
  let actorCookie: string;

  const call = async (
    method: 'get' | 'post' | 'patch',
    path: string,
    specPath: string,
    cookie: string | null = actorCookie,
    body?: unknown,
    origin = ORIGIN
  ) => {
    const response = await fetch(`${baseUrl}/api/v0/admin${path}`, {
      method: method.toUpperCase(),
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    await expectMatchesSpec(contract, response, { method, path: specPath });
    return response;
  };

  const addMember = async (
    name: string,
    role: MemberRole = 'OPERATOR',
    status: MemberStatus = 'ACTIVE',
    completed = true
  ) => {
    await database.db.insert(members).values({
      email: email(name),
      role,
      status,
      displayName: completed ? displayName() : null,
      jobRole: completed ? 'BE' : null,
      lastLoginAt: status === 'ACTIVE' ? new Date() : null,
    });
    const [row] = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email(name)))
      .limit(1);
    return row!;
  };

  const signIn = async (name: string): Promise<string> => {
    const response = await fetch(`${baseUrl}/api/v0/admin/auth/dev-login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ email: email(name) }),
    });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .find((value) => value.startsWith('session='))!
      .split(';')[0];
  };

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    ({ app, baseUrl, database } = await startAuthApp(readTestDatabaseConfig(), email));
    actorId = (await addMember('actor', 'SUPER_ADMIN')).id;
    actorCookie = await signIn('actor');
  });

  afterAll(async () => {
    await database?.db
      .delete(changeLogs)
      .where(or(like(changeLogs.actorEmail, `${RUN}%`), like(changeLogs.targetLabel, `${RUN}%`)));
    if (database) await deleteTestRun(database, RUN);
    await app?.close();
  });

  test('only a signed-in super admin can access the list, and role denials are recorded', async () => {
    const guest = await call('get', '/team-members', '/team-members', null);
    expect(guest.status).toBe(401);

    for (const role of ['OPERATOR', 'VIEWER'] as const) {
      await addMember(role.toLowerCase(), role);
      const cookie = await signIn(role.toLowerCase());
      const denied = await call('get', '/team-members', '/team-members', cookie);
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe('FORBIDDEN');
      const denial = await database.db
        .select()
        .from(accessLogs)
        .where(eq(accessLogs.email, email(role.toLowerCase())));
      expect(denial).toContainEqual(expect.objectContaining({ event: 'ACCESS_DENIED', result: 'FORBIDDEN' }));
    }

    const allowed = await call('get', '/team-members', '/team-members');
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: actorId, role: 'SUPER_ADMIN' })])
    );
  });

  test('registration normalizes email, rejects duplicates and records one successful change', async () => {
    const created = await call('post', '/team-members', '/team-members', actorCookie, {
      email: `  ${email('new').toUpperCase()}  `,
      role: 'VIEWER',
    });
    expect(created.status).toBe(201);
    const createdMember = await created.json();
    expect(createdMember).toMatchObject({
      email: email('new'),
      role: 'VIEWER',
      status: 'REGISTERED',
      displayName: null,
    });

    const duplicate = await call('post', '/team-members', '/team-members', actorCookie, {
      email: email('new'),
      role: 'OPERATOR',
    });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).code).toBe('TEAM_MEMBER_EMAIL_DUPLICATE');

    const logs = await database.db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.targetLabel, email('new')));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'ACCOUNT_REGISTERED',
      actorEmail: email('actor'),
      targetType: 'ACCOUNT',
      targetId: createdMember.id,
    });
  });

  test('registration directs inactive and cancelled addresses to reactivation', async () => {
    await addMember('inactive', 'OPERATOR', 'INACTIVE');
    await addMember('cancelled', 'OPERATOR', 'CANCELLED', false);
    for (const name of ['inactive', 'cancelled']) {
      const response = await call('post', '/team-members', '/team-members', actorCookie, {
        email: email(name),
        role: 'VIEWER',
      });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('TEAM_MEMBER_EMAIL_INACTIVE');
    }
  });

  test('role changes reject self, invalid states and missing members', async () => {
    const self = await call('patch', `/team-members/${actorId}`, '/team-members/{memberId}', actorCookie, {
      role: 'VIEWER',
    });
    expect(self.status).toBe(409);
    expect((await self.json()).code).toBe('TEAM_MEMBER_PROTECTED');

    const selfDeactivate = await call(
      'post',
      `/team-members/${actorId}/deactivate`,
      '/team-members/{memberId}/deactivate'
    );
    expect(selfDeactivate.status).toBe(409);
    expect((await selfDeactivate.json()).code).toBe('TEAM_MEMBER_PROTECTED');

    const missing = await call('patch', '/team-members/2147483647', '/team-members/{memberId}', actorCookie, {
      role: 'VIEWER',
    });
    expect(missing.status).toBe(404);
    const target = await addMember('role-target');
    const changed = await call('patch', `/team-members/${target.id}`, '/team-members/{memberId}', actorCookie, {
      role: 'VIEWER',
    });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ role: 'VIEWER' });
    const logs = await database.db.select().from(changeLogs).where(eq(changeLogs.targetId, target.id));
    expect(logs).toContainEqual(
      expect.objectContaining({ action: 'ACCOUNT_ROLE_CHANGED', beforeValue: 'OPERATOR', afterValue: 'VIEWER' })
    );
    await database.db.update(members).set({ status: 'INACTIVE' }).where(eq(members.id, target.id));
    const inactive = await call('patch', `/team-members/${target.id}`, '/team-members/{memberId}', actorCookie, {
      role: 'OPERATOR',
    });
    expect(inactive.status).toBe(409);
    expect((await inactive.json()).code).toBe('TEAM_MEMBER_STATE_CHANGED');
  });

  test('cancel, reactivate, deactivate and reactivate follow the state table and invalidate sessions', async () => {
    const created = await call('post', '/team-members', '/team-members', actorCookie, {
      email: email('lifecycle'),
      role: 'OPERATOR',
    });
    const { id } = (await created.json()) as { id: number };
    const path = (action: string) => `/team-members/${id}/${action}`;
    const spec = (action: string) => `/team-members/{memberId}/${action}`;

    const cancelled = await call('post', path('cancel'), spec('cancel'));
    expect(await cancelled.json()).toMatchObject({ status: 'CANCELLED' });
    expect((await call('post', path('cancel'), spec('cancel'))).status).toBe(409);

    const registered = await call('post', path('reactivate'), spec('reactivate'));
    expect(await registered.json()).toMatchObject({ status: 'REGISTERED' });
    const targetCookie = await signIn('lifecycle');

    const deactivated = await call('post', path('deactivate'), spec('deactivate'));
    expect(await deactivated.json()).toMatchObject({ status: 'INACTIVE' });
    expect((await call('post', path('deactivate'), spec('deactivate'))).status).toBe(409);
    const after = await fetch(`${baseUrl}/api/v0/admin/me`, { headers: { cookie: targetCookie } });
    expect(after.status).toBe(401);

    const active = await call('post', path('reactivate'), spec('reactivate'));
    expect(await active.json()).toMatchObject({ status: 'ACTIVE' });
    expect((await call('post', path('reactivate'), spec('reactivate'))).status).toBe(409);
    const actions = await database.db
      .select({ action: changeLogs.action })
      .from(changeLogs)
      .where(eq(changeLogs.targetLabel, email('lifecycle')))
      .orderBy(asc(changeLogs.id));
    expect(actions.map(({ action }) => action)).toEqual([
      'ACCOUNT_REGISTERED',
      'ACCOUNT_REGISTRATION_CANCELLED',
      'ACCOUNT_REACTIVATED',
      'ACCOUNT_DEACTIVATED',
      'ACCOUNT_REACTIVATED',
    ]);
  });

  test('every team member route enforces authentication and role before handling its request', async () => {
    await addMember('limited', 'OPERATOR');
    const limitedCookie = await signIn('limited');
    const routes = [
      ['get', '/team-members', '/team-members', undefined],
      ['post', '/team-members', '/team-members', { email: email('guarded'), role: 'VIEWER' }],
      ['patch', '/team-members/2147483647', '/team-members/{memberId}', { role: 'VIEWER' }],
      ['post', '/team-members/2147483647/deactivate', '/team-members/{memberId}/deactivate', undefined],
      ['post', '/team-members/2147483647/cancel', '/team-members/{memberId}/cancel', undefined],
      ['post', '/team-members/2147483647/reactivate', '/team-members/{memberId}/reactivate', undefined],
    ] as const;
    for (const [method, path, specPath, body] of routes) {
      expect((await call(method, path, specPath, null, body)).status).toBe(401);
      expect((await call(method, path, specPath, limitedCookie, body)).status).toBe(403);
    }
  });

  test('every memberId route reports invalid path parameters as field-level 400 errors', async () => {
    const routes = [
      ['patch', '/team-members/abc', '/team-members/{memberId}', { role: 'VIEWER' }],
      ['post', '/team-members/abc/deactivate', '/team-members/{memberId}/deactivate', undefined],
      ['post', '/team-members/abc/cancel', '/team-members/{memberId}/cancel', undefined],
      ['post', '/team-members/abc/reactivate', '/team-members/{memberId}/reactivate', undefined],
    ] as const;
    for (const [method, path, specPath, body] of routes) {
      const response = await call(method, path, specPath, actorCookie, body);
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [expect.objectContaining({ field: 'memberId' })],
      });
      expect(error.details[0].reason).toMatch(/[가-힣]/);
    }
  });

  test('invalid requests and forbidden Origins match the spec', async () => {
    const invalid = await call('post', '/team-members', '/team-members', actorCookie, {
      email: 'not-email',
      role: 'ADMIN',
    });
    expect(invalid.status).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.details.map((detail: { field: string }) => detail.field)).toEqual(
      expect.arrayContaining(['email', 'role'])
    );
    expect(invalidBody.details).toContainEqual({ field: 'email', reason: '잘못된 이메일 주소' });

    const forbidden = await call(
      'post',
      '/team-members',
      '/team-members',
      actorCookie,
      { email: email('blocked'), role: 'VIEWER' },
      'https://evil.example'
    );
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).code).toBe('FORBIDDEN');
  });

  test('simultaneous demotions cannot remove every active super admin', async () => {
    const second = await addMember('second-admin', 'SUPER_ADMIN');
    const secondCookie = await signIn('second-admin');
    const before = await database.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.role, 'SUPER_ADMIN'), eq(members.status, 'ACTIVE')));
    const otherAdmins = before.filter(({ id }) => id !== actorId && id !== second.id);
    const [first, other] = await Promise.all([
      call('patch', `/team-members/${second.id}`, '/team-members/{memberId}', actorCookie, { role: 'OPERATOR' }),
      call('patch', `/team-members/${actorId}`, '/team-members/{memberId}', secondCookie, { role: 'OPERATOR' }),
    ]);
    const activeAdmins = await database.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(inArray(members.id, [actorId, second.id]), eq(members.role, 'SUPER_ADMIN'), eq(members.status, 'ACTIVE'))
      );
    if (otherAdmins.length === 0) {
      expect([first.status, other.status].sort()).toEqual([200, 409]);
      expect(activeAdmins).toHaveLength(1);
    } else {
      expect([first.status, other.status]).toEqual([200, 200]);
    }
  });
});
