import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { IdeaReader } from '../../src/ideas/idea-reader.js';
import { IdeasController } from '../../src/ideas/ideas.controller.js';
import { IdeasService } from '../../src/ideas/ideas.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { members, type MemberRole, type MemberStatus } from '../../src/database/schema.js';
import {
  SERVICE_DATABASE_CONFIG,
  ServiceDatabaseService,
} from '../../src/service-database/service-database.service.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
import { ServiceFixture, type FixtureUser } from '../support/service-fixture.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const RUN = `vitest-idea-${Date.now()}`;
const TAG = `I${String(Date.now()).slice(-8)}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
const T = Date.UTC(2026, 9, 20, 0, 0, 0);
const at = (hours: number) => new Date(T + hours * 3_600_000);
let nameSeq = 0;

describe.skipIf(!hasDatabase)('idea suggestions (real database, fake service data)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;
  let fixture: ServiceFixture;
  const cookies = {} as Record<'super' | 'operator' | 'viewer' | 'fresh', string>;
  let guardian: FixtureUser;
  let director: FixtureUser;
  let guardian2: FixtureUser;
  const seeded = {} as Record<'a' | 'b' | 'c' | 'd' | 'e', number>;

  const call = async (path: string, specPath: string, cookie: string | null = cookies.viewer) => {
    const response = await fetch(`${baseUrl}/api/v0/admin${path}`, {
      headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    });
    await expectMatchesSpec(contract, response, { method: 'get', path: specPath });
    return response;
  };

  const addMember = async (name: string, role: MemberRole, status: MemberStatus = 'ACTIVE', completed = true) => {
    await database.db.insert(members).values({
      email: email(name),
      role,
      status,
      displayName: completed ? `제${Date.now() % 100_000}${++nameSeq}` : null,
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
      .split(';')[0]!;
  };

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    const config = readTestDatabaseConfig();
    fixture = await ServiceFixture.create(config, RUN);
    ({ app, baseUrl, database } = await startAuthApp(config, email, undefined, {
      controllers: [IdeasController],
      providers: [
        { provide: SERVICE_DATABASE_CONFIG, useValue: config },
        ServiceDatabaseService,
        IdeaReader,
        IdeasService,
      ],
    }));

    await addMember('super', 'SUPER_ADMIN');
    await addMember('operator', 'OPERATOR');
    await addMember('viewer', 'VIEWER');
    await addMember('fresh', 'VIEWER', 'REGISTERED', false);
    for (const name of ['super', 'operator', 'viewer'] as const) cookies[name] = await signIn(name);
    cookies.fresh = await signIn('fresh');

    guardian = await fixture.addUser('g1');
    director = await fixture.addUser('d1');
    guardian2 = await fixture.addUser('g2');
    seeded.a = await fixture.addIdea({
      user: guardian,
      content: `알림을 개선해 주세요 ${TAG} ALPHA`,
      createdAt: at(5),
    });
    seeded.b = await fixture.addIdea({
      user: director,
      type: 'OWNER',
      content: `정산 화면을 보고 싶어요 ${TAG} bravo`,
      createdAt: at(4),
    });
    seeded.c = await fixture.addIdea({ user: guardian, content: `100% 만족_테스트 ${TAG}`, createdAt: at(3) });
    // 제출 시각이 같으면 ID가 큰 쪽이 먼저다.
    seeded.d = await fixture.addIdea({ user: guardian2, content: `산책 기록 ${TAG}`, createdAt: at(3) });
    seeded.e = await fixture.addIdea({ user: director, type: 'OWNER', content: `출석 알림 ${TAG}`, createdAt: at(1) });
  });

  afterAll(async () => {
    if (database) await deleteTestRun(database, RUN);
    await fixture?.close();
    await app?.close();
  });

  const list = async (query: string, cookie?: string | null) => {
    const response = await call(`/ideas?keyword=${encodeURIComponent(TAG)}${query}`, '/ideas', cookie);
    return { response, body: (await response.clone().json()) as Record<string, any> };
  };
  const ids = (body: Record<string, any>) => (body.items as Array<{ id: number }>).map((item) => item.id);

  // ---------- 권한

  test('every signed-in team member with a profile can read, others cannot', async () => {
    expect((await call('/ideas', '/ideas', null)).status).toBe(401);
    expect((await call(`/ideas/${seeded.a}`, '/ideas/{id}', null)).status).toBe(401);
    for (const name of ['super', 'operator', 'viewer'] as const) {
      expect((await call('/ideas', '/ideas', cookies[name])).status).toBe(200);
      expect((await call(`/ideas/${seeded.a}`, '/ideas/{id}', cookies[name])).status).toBe(200);
    }
    expect((await call('/ideas', '/ideas', cookies.fresh)).status).toBe(403);
  });

  // ---------- 목록

  test('lists newest first, ties by larger id, with user info and UTC time', async () => {
    const { response, body } = await list('');
    expect(response.status).toBe(200);
    expect(ids(body)).toEqual([seeded.a, seeded.b, seeded.d, seeded.c, seeded.e]);
    expect(body).toMatchObject({ page: 1, size: 20, totalItems: 5, totalPages: 1 });

    const byId = new Map((body.items as Array<Record<string, any>>).map((item) => [item.id, item]));
    expect(byId.get(seeded.a)).toEqual({
      id: seeded.a,
      content: `알림을 개선해 주세요 ${TAG} ALPHA`,
      user: { type: 'GUARDIAN', name: guardian.name, email: guardian.email },
      submittedAt: at(5).toISOString(),
    });
    expect(byId.get(seeded.b)).toMatchObject({ user: { type: 'DIRECTOR', name: director.name } });
  });

  test('sorts oldest first when asked, ties still by larger id', async () => {
    const { body } = await list('&sort=OLDEST');
    expect(ids(body)).toEqual([seeded.e, seeded.d, seeded.c, seeded.b, seeded.a]);
  });

  test('filters by user type', async () => {
    expect(ids((await list('&userType=DIRECTOR')).body)).toEqual([seeded.b, seeded.e]);
    expect(ids((await list('&userType=GUARDIAN')).body)).toEqual([seeded.a, seeded.d, seeded.c]);
  });

  test('searches content, user name, and email, ignoring case and matching parts', async () => {
    // 내용(대소문자 무시)
    const content = await call(`/ideas?keyword=${encodeURIComponent(`${TAG} alpha`)}`, '/ideas');
    expect(ids(await content.json())).toEqual([seeded.a]);

    // 이메일 일부(대문자로 써도 찾는다)
    const byEmail = await call(`/ideas?keyword=${encodeURIComponent(`${RUN}-D1@`.toUpperCase())}`, '/ideas');
    expect(ids(await byEmail.json())).toEqual([seeded.b, seeded.e]);

    // 이름 일부
    const byName = await call(`/ideas?keyword=${encodeURIComponent(director.name)}`, '/ideas');
    expect(ids(await byName.json())).toEqual([seeded.b, seeded.e]);
  });

  test('treats % and _ in the keyword as plain characters', async () => {
    const literal = await call(`/ideas?keyword=${encodeURIComponent('100% 만족_테')}`, '/ideas');
    expect(ids(await literal.json())).toEqual([seeded.c]);
    const wildcard = await call(`/ideas?keyword=${encodeURIComponent('100_ 만족')}`, '/ideas');
    expect(ids(await wildcard.json())).toEqual([]);
  });

  test('pages by size and reports totals', async () => {
    const { body } = await list('&page=2&size=2');
    expect(ids(body)).toEqual([seeded.d, seeded.c]);
    expect(body).toMatchObject({ page: 2, size: 2, totalItems: 5, totalPages: 3 });

    const beyond = (await list('&page=9&size=2')).body;
    expect(beyond.items).toEqual([]);
    expect(beyond).toMatchObject({ page: 9, totalItems: 5, totalPages: 3 });
  });

  test('rejects invalid list queries', async () => {
    for (const query of [
      'page=0',
      'size=0',
      'size=101',
      'sort=NEWEST',
      'userType=ADMIN',
      `keyword=${'a'.repeat(101)}`,
    ]) {
      const response = await call(`/ideas?${query}`, '/ideas');
      expect(response.status, query).toBe(400);
    }
  });

  // ---------- 상세

  test('shows one idea', async () => {
    const response = await call(`/ideas/${seeded.b}`, '/ideas/{id}');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: seeded.b,
      content: `정산 화면을 보고 싶어요 ${TAG} bravo`,
      user: { type: 'DIRECTOR', name: director.name, email: director.email },
      submittedAt: at(4).toISOString(),
    });
  });

  test('answers 404 for a missing idea and 400 for a malformed id', async () => {
    const missing = await call('/ideas/2147483647', '/ideas/{id}');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'IDEA_NOT_FOUND' });

    for (const id of ['abc', '0', '-1', '1.5']) {
      expect((await call(`/ideas/${id}`, '/ideas/{id}')).status, id).toBe(400);
    }
  });
});
