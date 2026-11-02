import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { ChangeLogController } from '../../src/change-log/change-log.controller.js';
import { ChangeLogReader } from '../../src/change-log/change-log-reader.js';
import { ChangeLogService } from '../../src/change-log/change-log.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { changeLogs, members, type MemberRole } from '../../src/database/schema.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const RUN = `vitest-clog-${Date.now()}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
// 시험 이력은 모두 과거 날짜이고 행위자로 걸러서 읽으므로 개발 DB의 실제 이력과 섞이지 않는다.
const at = (iso: string) => new Date(iso);

describe.skipIf(!hasDatabase)('change log API (real database)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;
  const cookies = {} as Record<'admin' | 'op' | 'viewer', string>;
  const ids = {} as Record<'admin' | 'other', number>;

  const get = async (query: string, cookie: string | null = cookies.admin) => {
    const response = await fetch(`${baseUrl}/api/v0/admin/change-logs${query}`, {
      headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    });
    await expectMatchesSpec(contract, response, { method: 'get', path: '/change-logs' });
    return response;
  };
  const mine = async (extra = '') => (await get(`?actorId=${ids.admin}${extra}`)).json();
  const labels = (page: { items: Array<{ target: { label: string } }> }) => page.items.map((item) => item.target.label);

  const addMember = async (name: string, role: MemberRole, displayName: string) => {
    await database.db.insert(members).values({
      email: email(name),
      role,
      status: 'ACTIVE',
      displayName,
      jobRole: 'BE',
      lastLoginAt: new Date(),
    });
    return (
      await database.db
        .select()
        .from(members)
        .where(eq(members.email, email(name)))
        .limit(1)
    )[0]!;
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
      .split(';')[0]!;
  };
  const addLog = (
    actorId: number,
    occurredAt: string,
    label: string,
    input: Partial<typeof changeLogs.$inferInsert> = {}
  ) =>
    database.db.insert(changeLogs).values({
      occurredAt: at(occurredAt),
      actorMemberId: actorId,
      actorEmail: email(actorId === ids.admin ? 'admin' : 'other'),
      actorDisplayName: actorId === ids.admin ? '기록관리' : '기록타인',
      actorJobRole: 'BE',
      targetType: 'NOTICE',
      targetId: 1,
      targetLabel: `${RUN}-${label}`,
      action: 'NOTICE_EDITED',
      ...input,
    });

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    const config = readTestDatabaseConfig();
    ({ app, baseUrl, database } = await startAuthApp(config, email, undefined, {
      controllers: [ChangeLogController],
      providers: [ChangeLogReader, ChangeLogService],
    }));
    const suffix = String(Date.now() % 100_000);
    ids.admin = (await addMember('admin', 'SUPER_ADMIN', `기록${suffix}`)).id;
    await addMember('op', 'OPERATOR', `운영${suffix}`);
    await addMember('viewer', 'VIEWER', `조회${suffix}`);
    ids.other = (await addMember('other', 'VIEWER', `타인${suffix}`)).id;
    for (const name of ['admin', 'op', 'viewer'] as const) cookies[name] = await signIn(name);

    // KST 2026-03-15의 하루는 UTC 03-14 15:00 ~ 03-15 14:59:59.999다.
    await addLog(ids.admin, '2026-03-14T14:59:59.999Z', 'before-day'); // KST 03-14 23:59:59
    await addLog(ids.admin, '2026-03-14T15:00:00.000Z', 'day-start'); // KST 03-15 00:00:00
    await addLog(ids.admin, '2026-03-15T14:59:59.999Z', 'day-end'); // KST 03-15 23:59:59
    await addLog(ids.admin, '2026-03-15T15:00:00.000Z', 'after-day'); // KST 03-16 00:00:00
    await addLog(ids.admin, '2026-03-20T00:00:00.000Z', 'tie-low-id', {
      targetType: 'INQUIRY',
      action: 'INQUIRY_REPLIED',
    });
    await addLog(ids.admin, '2026-03-20T00:00:00.000Z', 'tie-high-id', {
      targetType: 'ACCOUNT',
      action: 'ACCOUNT_ROLE_CHANGED',
      beforeValue: 'OPERATOR',
      afterValue: 'VIEWER',
    });
    await addLog(ids.other, '2026-03-21T00:00:00.000Z', 'other-actor');
  });

  afterAll(async () => {
    await database?.db.delete(changeLogs).where(like(changeLogs.targetLabel, `${RUN}%`));
    if (database) await deleteTestRun(database, RUN);
    await app?.close();
  });

  describe('access', () => {
    test('only a super admin can read', async () => {
      expect((await get('', cookies.admin)).status).toBe(200);
      expect((await get('', cookies.op)).status).toBe(403);
      expect((await get('', cookies.viewer)).status).toBe(403);
      expect((await get('', null)).status).toBe(401);
    });

    test('invalid queries are validation errors', async () => {
      for (const query of [
        '?size=101',
        '?page=0',
        '?actorId=abc',
        '?targetType=X',
        '?from=2026-02-30',
        '?from=2026-03-15&to=2026-03-14',
      ]) {
        expect((await get(query)).status, query).toBe(400);
      }
    });
  });

  describe('list', () => {
    test('newest first, equal times by id descending, with the recorded snapshot', async () => {
      const page = await mine('&from=2026-03-20&to=2026-03-20');
      expect(labels(page)).toEqual([`${RUN}-tie-high-id`, `${RUN}-tie-low-id`]);
      const [high, low] = page.items;
      expect(high.id).toBeGreaterThan(low.id);
      expect(high).toMatchObject({
        occurredAt: '2026-03-20T00:00:00.000Z',
        actor: { id: ids.admin, displayName: '기록관리', jobRole: 'BE', email: email('admin') },
        targetType: 'ACCOUNT',
        action: 'ACCOUNT_ROLE_CHANGED',
        change: { from: 'OPERATOR', to: 'VIEWER' },
      });
      expect(low).toMatchObject({ targetType: 'INQUIRY', change: null });
    });

    test('the period is in KST dates and includes the end date', async () => {
      const day = await mine('&from=2026-03-15&to=2026-03-15');
      expect(labels(day)).toEqual([`${RUN}-day-end`, `${RUN}-day-start`]);
      expect(labels(await mine('&to=2026-03-14'))).toEqual([`${RUN}-before-day`]);
      expect(labels(await mine('&from=2026-03-16&to=2026-03-19'))).toEqual([`${RUN}-after-day`]);
      const all = await mine();
      expect(all.totalItems).toBe(6);
      expect(all.items[0].occurredAt > all.items.at(-1).occurredAt).toBe(true);
    });

    test('filters by actor and target type', async () => {
      expect(labels(await (await get(`?actorId=${ids.other}`)).json())).toEqual([`${RUN}-other-actor`]);
      const accounts = await mine('&targetType=ACCOUNT');
      expect(labels(accounts)).toEqual([`${RUN}-tie-high-id`]);
      expect((await mine('&targetType=TERMS_VERSION')).items).toEqual([]);
    });

    test('pages with correct metadata', async () => {
      const first = await mine('&size=4');
      expect(first).toMatchObject({ page: 1, size: 4, totalItems: 6, totalPages: 2 });
      const second = await mine('&size=4&page=2');
      expect(second.items).toHaveLength(2);
      const seen = [...first.items, ...second.items].map((item: { id: number }) => item.id);
      expect(new Set(seen).size).toBe(6);
      expect((await mine('&size=4&page=3')).items).toEqual([]);
    });
  });
});
