import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { and, eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { INQUIRY_IMAGE_BASE_URL } from '../../src/inquiries/inquiries.config.js';
import { InquiriesController } from '../../src/inquiries/inquiries.controller.js';
import { InquiriesService } from '../../src/inquiries/inquiries.service.js';
import { InquiryReader } from '../../src/inquiries/inquiry-reader.js';
import { JAVA_API_CONFIG, JavaApiClient } from '../../src/java-api/java-api.client.js';
import {
  SERVICE_DATABASE_CONFIG,
  ServiceDatabaseService,
} from '../../src/service-database/service-database.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { changeLogs, members, type MemberRole, type MemberStatus } from '../../src/database/schema.js';
import { FAKE_JAVA_KEY, startFakeJava, type FakeJava } from '../support/fake-java.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { ServiceFixture, type FixtureUser } from '../support/service-fixture.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const RUN = `vitest-inq-${Date.now()}`;
const TAG = `K${String(Date.now()).slice(-8)}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
const IMAGE_BASE = 'https://images.test';
const T = Date.UTC(2026, 9, 20, 0, 0, 0);
const at = (hours: number) => new Date(T + hours * 3_600_000);

let nameSeq = 0;
const displayName = () => `문${Date.now() % 100_000}${++nameSeq}`;

describe.skipIf(!hasDatabase)('inquiry operations (real database, fake service data and fake Java)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;
  let fixture: ServiceFixture;
  let java: FakeJava;
  const ids = {} as Record<'op' | 'other' | 'gone' | 'actor', number>;
  const names = {} as Record<'op' | 'other' | 'gone', string>;
  const cookies = {} as Record<'actor' | 'op' | 'other' | 'viewer', string>;
  let guardian: FixtureUser;
  let director: FixtureUser;
  let guardian2: FixtureUser;
  const seeded = {} as Record<'i1' | 'i2' | 'i3' | 'i4' | 'i5', number>;

  const call = async (
    method: 'get' | 'post' | 'delete',
    path: string,
    specPath: string,
    options: { cookie?: string | null; body?: unknown; origin?: string } = {}
  ) => {
    const cookie = options.cookie === undefined ? cookies.op : options.cookie;
    const response = await fetch(`${baseUrl}/api/v0/admin${path}`, {
      method: method.toUpperCase(),
      headers: {
        origin: options.origin ?? ORIGIN,
        ...(cookie ? { cookie } : {}),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    await expectMatchesSpec(contract, response, { method, path: specPath });
    return response;
  };

  const addMember = async (name: string, role: MemberRole, status: MemberStatus = 'ACTIVE', completed = true) => {
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
      .split(';')[0]!;
  };

  /** 변경 이력(시험 실행이 만든 것만). */
  const logsOf = async (inquiryId: number) =>
    database.db
      .select()
      .from(changeLogs)
      .where(
        and(
          eq(changeLogs.targetType, 'INQUIRY'),
          eq(changeLogs.targetId, inquiryId),
          like(changeLogs.actorEmail, `${RUN}%`)
        )
      );

  const newInquiry = (status: 'WAITING' | 'CHECKING' | 'ANSWERED' | 'RESOLVED', assignee: number | null = null) =>
    fixture.addInquiry({
      user: guardian,
      title: `새 문의 ${TAG}`,
      status,
      assigneeMemberId: assignee,
      lastActivityAt: at(-100),
    });

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    const config = readTestDatabaseConfig();
    fixture = await ServiceFixture.create(config, RUN);
    java = await startFakeJava(fixture);
    ({ app, baseUrl, database } = await startAuthApp(config, email, undefined, {
      controllers: [InquiriesController],
      providers: [
        { provide: SERVICE_DATABASE_CONFIG, useValue: config },
        { provide: JAVA_API_CONFIG, useValue: { baseUrl: java.baseUrl, apiKey: FAKE_JAVA_KEY } },
        { provide: INQUIRY_IMAGE_BASE_URL, useValue: IMAGE_BASE },
        ServiceDatabaseService,
        JavaApiClient,
        InquiryReader,
        InquiriesService,
      ],
    }));

    ids.actor = (await addMember('actor', 'SUPER_ADMIN')).id;
    const op = await addMember('op', 'OPERATOR');
    const other = await addMember('other', 'OPERATOR');
    const gone = await addMember('gone', 'OPERATOR', 'INACTIVE');
    await addMember('viewer', 'VIEWER');
    await addMember('fresh', 'OPERATOR', 'REGISTERED', false);
    ids.op = op.id;
    ids.other = other.id;
    ids.gone = gone.id;
    names.op = op.displayName!;
    names.other = other.displayName!;
    names.gone = gone.displayName!;
    for (const name of ['actor', 'op', 'other', 'viewer'] as const) cookies[name] = await signIn(name);

    guardian = await fixture.addUser('g1');
    director = await fixture.addUser('d1');
    guardian2 = await fixture.addUser('g2');
    seeded.i1 = await fixture.addInquiry({
      user: guardian,
      title: `알림 ${TAG}`,
      status: 'WAITING',
      lastActivityAt: at(5),
      messages: [{ sender: 'USER', body: '알림이 오지 않아요 ALPHA', createdAt: at(5) }],
    });
    seeded.i2 = await fixture.addInquiry({
      user: director,
      type: 'OWNER',
      title: `결제 ${TAG}`,
      status: 'CHECKING',
      assigneeMemberId: ids.op,
      lastActivityAt: at(4),
      createdAt: at(1),
      messages: [
        { sender: 'USER', body: '결제가 두 번 됐어요', createdAt: at(1) },
        { sender: 'OPERATOR', body: '확인해 보겠습니다 BRAVO', createdAt: at(2), authorMemberId: ids.op },
        {
          sender: 'USER',
          body: '사진 첨부합니다',
          createdAt: at(4),
          images: [
            { s3Key: 'inquiry/2/a.jpg', fileName: 'a.jpg' },
            { s3Key: 'inquiry/2/b.png', fileName: 'b.png' },
          ],
        },
      ],
    });
    seeded.i3 = await fixture.addInquiry({
      user: guardian,
      title: `수업 ${TAG}`,
      status: 'ANSWERED',
      assigneeMemberId: ids.other,
      lastActivityAt: at(3),
    });
    seeded.i4 = await fixture.addInquiry({
      user: director,
      type: 'OWNER',
      title: `정산 ${TAG}`,
      status: 'RESOLVED',
      assigneeMemberId: ids.gone,
      lastActivityAt: at(2),
    });
    seeded.i5 = await fixture.addInquiry({
      user: guardian2,
      title: `예약 ${TAG}`,
      status: 'WAITING',
      lastActivityAt: at(2),
    });
  });

  afterAll(async () => {
    await database?.db.delete(changeLogs).where(like(changeLogs.actorEmail, `${RUN}%`));
    if (database) await deleteTestRun(database, RUN);
    await fixture?.close();
    await java?.close();
    await app?.close();
  });

  const list = async (query: string, cookie?: string | null) => {
    const response = await call('get', `/inquiries?keyword=${TAG}${query}`, '/inquiries', { cookie });
    return { response, body: (await response.clone().json()) as Record<string, any> };
  };
  const listedIds = (body: Record<string, any>) => (body.items as Array<{ id: number }>).map((item) => item.id);

  // ---------- 권한

  test('only signed-in super admins and operators can use inquiries', async () => {
    expect((await call('get', '/inquiries', '/inquiries', { cookie: null })).status).toBe(401);
    expect((await call('get', '/inquiries', '/inquiries', { cookie: cookies.viewer })).status).toBe(403);
    expect((await call('get', '/inquiries/assignees', '/inquiries/assignees', { cookie: cookies.viewer })).status).toBe(
      403
    );
    expect((await call('get', `/inquiries/${seeded.i1}`, '/inquiries/{id}', { cookie: cookies.viewer })).status).toBe(
      403
    );
    expect((await call('get', '/inquiries', '/inquiries', { cookie: cookies.actor })).status).toBe(200);
    expect((await call('get', '/inquiries', '/inquiries', { cookie: cookies.op })).status).toBe(200);
  });

  // ---------- 목록

  test('lists newest activity first, ties by larger id, with user and assignee info', async () => {
    const { response, body } = await list('');
    expect(response.status).toBe(200);
    expect(listedIds(body)).toEqual([seeded.i1, seeded.i2, seeded.i3, seeded.i5, seeded.i4]);
    expect(body).toMatchObject({ page: 1, size: 20, totalItems: 5, totalPages: 1 });

    const byId = new Map((body.items as Array<Record<string, any>>).map((item) => [item.id, item]));
    expect(byId.get(seeded.i1)).toMatchObject({
      status: 'WAITING',
      title: `알림 ${TAG}`,
      user: { type: 'GUARDIAN', name: guardian.name, email: guardian.email },
      assignee: null,
      lastActivityAt: at(5).toISOString(),
    });
    expect(byId.get(seeded.i2)).toMatchObject({
      status: 'CHECKING',
      user: { type: 'DIRECTOR' },
      assignee: { id: ids.op, displayName: names.op, jobRole: 'BE', isActive: true },
    });
    expect(byId.get(seeded.i4)!.assignee).toMatchObject({ id: ids.gone, isActive: false });
  });

  test('pages with page and size, and oldest-first sorting reverses the order', async () => {
    const second = await list('&size=2&page=2');
    expect(listedIds(second.body)).toEqual([seeded.i3, seeded.i5]);
    expect(second.body).toMatchObject({ page: 2, size: 2, totalItems: 5, totalPages: 3 });

    const oldest = await list('&sort=OLDEST');
    // 같은 시각이면 최신 목록과 마찬가지로 ID가 큰 문의가 먼저다.
    expect(listedIds(oldest.body)).toEqual([seeded.i5, seeded.i4, seeded.i3, seeded.i2, seeded.i1]);
  });

  test('filters by status, user type and assignee', async () => {
    expect(listedIds((await list('&status=WAITING')).body)).toEqual([seeded.i1, seeded.i5]);
    expect(listedIds((await list('&userType=DIRECTOR')).body)).toEqual([seeded.i2, seeded.i4]);
    expect(listedIds((await list('&assignee=UNASSIGNED')).body)).toEqual([seeded.i1, seeded.i5]);
    expect(listedIds((await list(`&assignee=${ids.other}`)).body)).toEqual([seeded.i3]);
    expect(listedIds((await list(`&assignee=${ids.gone}`)).body)).toEqual([seeded.i4]);
    const mine = await call('get', `/inquiries?keyword=${TAG}&assignee=ME`, '/inquiries', { cookie: cookies.op });
    expect(listedIds(await mine.json())).toEqual([seeded.i2]);
    expect(listedIds((await list(`&status=WAITING&userType=GUARDIAN&assignee=UNASSIGNED`)).body)).toEqual([
      seeded.i1,
      seeded.i5,
    ]);
  });

  test('keyword search covers title, user name, email, inquiry id and the whole conversation, ignoring case', async () => {
    const search = async (keyword: string) => {
      const response = await call('get', `/inquiries?keyword=${encodeURIComponent(keyword)}`, '/inquiries');
      return listedIds(await response.json());
    };
    expect(await search(`결제 ${TAG}`)).toEqual([seeded.i2]);
    expect(await search(director.name)).toEqual([seeded.i2, seeded.i4]);
    expect(await search(guardian2.email)).toEqual([seeded.i5]);
    expect(await search(String(seeded.i3))).toContain(seeded.i3);
    expect(await search('alpha')).toEqual([seeded.i1]);
    expect(await search('bravo')).toEqual([seeded.i2]);
    expect(await search('NO-SUCH-TEXT-XYZ')).toEqual([]);
  });

  test('rejects invalid list queries', async () => {
    for (const query of [
      'page=0',
      'size=0',
      'size=101',
      'status=BOGUS',
      'userType=BOGUS',
      'sort=NEWEST',
      'assignee=abc',
    ]) {
      const response = await call('get', `/inquiries?${query}`, '/inquiries');
      expect(response.status, query).toBe(400);
      expect((await response.json()).code).toBe('VALIDATION_FAILED');
    }
  });

  // ---------- 담당자 후보

  test('assignee candidates include inactive members with a display name and skip unnamed ones', async () => {
    const response = await call('get', '/inquiries/assignees', '/inquiries/assignees');
    expect(response.status).toBe(200);
    const items = (await response.json()) as Array<{ id: number; isActive: boolean; displayName: string }>;
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.op, isActive: true, email: email('op'), jobRole: 'BE' }),
        expect.objectContaining({ id: ids.gone, isActive: false }),
      ])
    );
    expect(items.map((item) => item.displayName)).not.toContain(null);
    expect(items.map((item) => item.id)).not.toContain(undefined);
    const fresh = await database.db
      .select()
      .from(members)
      .where(eq(members.email, email('fresh')));
    expect(items.map((item) => item.id)).not.toContain(fresh[0]!.id);
  });

  // ---------- 상세

  test('detail returns the conversation in order with author names and image urls', async () => {
    const response = await call('get', `/inquiries/${seeded.i2}`, '/inquiries/{id}');
    expect(response.status).toBe(200);
    const detail = (await response.json()) as Record<string, any>;
    expect(detail).toMatchObject({
      id: seeded.i2,
      status: 'CHECKING',
      title: `결제 ${TAG}`,
      user: { type: 'DIRECTOR', name: director.name, email: director.email },
      assignee: { id: ids.op, displayName: names.op },
      createdAt: at(1).toISOString(),
      lastActivityAt: at(4).toISOString(),
    });
    expect(detail.messages.map((m: any) => [m.author, m.authorName, m.body])).toEqual([
      ['USER', director.name, '결제가 두 번 됐어요'],
      ['OPERATOR', names.op, '확인해 보겠습니다 BRAVO'],
      ['USER', director.name, '사진 첨부합니다'],
    ]);
    expect(detail.messages[0].images).toEqual([]);
    expect(detail.messages[2].images).toEqual([
      expect.objectContaining({ url: `${IMAGE_BASE}/inquiry/2/a.jpg`, fileName: 'a.jpg' }),
      expect.objectContaining({ url: `${IMAGE_BASE}/inquiry/2/b.png`, fileName: 'b.png' }),
    ]);
    expect(typeof detail.messages[0].id).toBe('string');
  });

  test('detail of an unknown inquiry is 404 and a malformed id is 400', async () => {
    const missing = await call('get', '/inquiries/999999999', '/inquiries/{id}');
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('INQUIRY_NOT_FOUND');
    const malformed = await call('get', '/inquiries/abc', '/inquiries/{id}');
    expect(malformed.status).toBe(400);
  });

  // ---------- 이전·다음

  test('adjacent follows the same filters and ordering as the list', async () => {
    const adjacent = async (id: number, query = '') => {
      const response = await call(
        'get',
        `/inquiries/${id}/adjacent?keyword=${TAG}${query}`,
        '/inquiries/{id}/adjacent'
      );
      expect(response.status).toBe(200);
      return (await response.json()) as { prevId: number | null; nextId: number | null };
    };
    expect(await adjacent(seeded.i1)).toEqual({ prevId: null, nextId: seeded.i2 });
    expect(await adjacent(seeded.i3)).toEqual({ prevId: seeded.i2, nextId: seeded.i5 });
    expect(await adjacent(seeded.i4)).toEqual({ prevId: seeded.i5, nextId: null });
    expect(await adjacent(seeded.i3, '&status=WAITING')).toEqual({ prevId: null, nextId: null });
    expect(await adjacent(seeded.i1, '&sort=OLDEST')).toEqual({ prevId: seeded.i2, nextId: null });
    expect(await adjacent(seeded.i1, '&status=WAITING')).toEqual({ prevId: null, nextId: seeded.i5 });
  });

  test('adjacent of an unknown inquiry is 404', async () => {
    const response = await call('get', '/inquiries/999999999/adjacent', '/inquiries/{id}/adjacent');
    expect(response.status).toBe(404);
  });

  // ---------- 맡기

  test('assigning an unassigned inquiry calls Java, returns the detail and records one change', async () => {
    const id = await newInquiry('WAITING');
    java.calls.length = 0;

    const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
      body: { expectedAssigneeId: null },
    });

    expect(response.status).toBe(200);
    const detail = await response.json();
    expect(detail).toMatchObject({ id, status: 'CHECKING', assignee: { id: ids.op, displayName: names.op } });
    expect(java.calls).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: `/api/v0/platform-admin/inquiries/${id}/assignee`,
        key: FAKE_JAVA_KEY,
        body: { memberId: ids.op, expectedAssigneeId: null },
      }),
    ]);
    const logs = await logsOf(id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'INQUIRY_ASSIGNED',
      targetLabel: `문의 #${id}`,
      actorMemberId: ids.op,
      beforeValue: null,
    });
  });

  test('taking over from another member records the change from the previous assignee', async () => {
    const id = await newInquiry('CHECKING', ids.other);

    const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
      body: { expectedAssigneeId: ids.other },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'CHECKING', assignee: { id: ids.op } });
    const logs = await logsOf(id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'INQUIRY_ASSIGNEE_CHANGED' });
    expect(logs[0]!.beforeValue).toContain(names.other);
    expect(logs[0]!.afterValue).toContain(names.op);
  });

  test('assigning with a stale view is a conflict that changes and records nothing', async () => {
    const id = await newInquiry('CHECKING', ids.other);

    const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
      body: { expectedAssigneeId: null },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('INQUIRY_ASSIGNEE_CHANGED');
    expect((await fixture.inquiry(id)).assignee_member_id).toBe(ids.other);
    expect(await logsOf(id)).toHaveLength(0);
  });

  test('assigning a resolved inquiry is rejected', async () => {
    const id = await newInquiry('RESOLVED');

    const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
      body: { expectedAssigneeId: null },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('INQUIRY_RESOLVED');
    expect(await logsOf(id)).toHaveLength(0);
  });

  test('assigning validates the body and the inquiry id, and needs an allowed origin and role', async () => {
    const id = await newInquiry('WAITING');
    const path = `/inquiries/${id}/assignee`;
    const spec = '/inquiries/{id}/assignee';

    expect((await call('post', path, spec, { body: {} })).status).toBe(400);
    expect((await call('post', path, spec, { body: { expectedAssigneeId: 'x' } })).status).toBe(400);
    expect(
      (await call('post', '/inquiries/999999999/assignee', spec, { body: { expectedAssigneeId: null } })).status
    ).toBe(404);
    expect(
      (await call('post', path, spec, { body: { expectedAssigneeId: null }, origin: 'https://evil.example' })).status
    ).toBe(403);
    expect(
      (await call('post', path, spec, { body: { expectedAssigneeId: null }, cookie: cookies.viewer })).status
    ).toBe(403);
    expect((await call('post', path, spec, { body: { expectedAssigneeId: null }, cookie: null })).status).toBe(401);
    expect((await fixture.inquiry(id)).assignee_member_id).toBeNull();
  });

  // ---------- 담당 해제 · 실행 취소

  test('the assignee can release, and the change is recorded with the previous assignee', async () => {
    const id = await newInquiry('CHECKING', ids.op);
    java.calls.length = 0;

    const response = await call('delete', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, status: 'CHECKING', assignee: null });
    expect(java.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/api/v0/platform-admin/inquiries/${id}/assignee?memberId=${ids.op}`,
      key: FAKE_JAVA_KEY,
    });
    const logs = await logsOf(id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'INQUIRY_ASSIGNEE_RELEASED', afterValue: null });
    expect(logs[0]!.beforeValue).toContain(names.op);
  });

  test('releasing someone else’s inquiry or a resolved one is rejected without a record', async () => {
    const others = await newInquiry('CHECKING', ids.other);
    const denied = await call('delete', `/inquiries/${others}/assignee`, '/inquiries/{id}/assignee');
    expect(denied.status).toBe(409);
    expect((await denied.json()).code).toBe('INQUIRY_ASSIGNEE_CHANGED');
    expect(await logsOf(others)).toHaveLength(0);

    const resolved = await newInquiry('RESOLVED', ids.op);
    const locked = await call('delete', `/inquiries/${resolved}/assignee`, '/inquiries/{id}/assignee');
    expect(locked.status).toBe(409);
    expect((await locked.json()).code).toBe('INQUIRY_RESOLVED');
  });

  test('undoing a release takes the inquiry back unless someone else took it meanwhile', async () => {
    const id = await newInquiry('CHECKING', ids.op);
    await call('delete', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee');

    const restored = await call('post', `/inquiries/${id}/assignee/restore`, '/inquiries/{id}/assignee/restore');
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({ status: 'CHECKING', assignee: { id: ids.op } });

    await call('delete', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee');
    await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
      cookie: cookies.other,
      body: { expectedAssigneeId: null },
    });
    const late = await call('post', `/inquiries/${id}/assignee/restore`, '/inquiries/{id}/assignee/restore');
    expect(late.status).toBe(409);
    expect((await late.json()).code).toBe('INQUIRY_ASSIGNEE_CHANGED');
    expect((await fixture.inquiry(id)).assignee_member_id).toBe(ids.other);
  });

  // ---------- 답변

  test('the assignee can reply: an operator message is added and the inquiry is answered', async () => {
    const id = await newInquiry('CHECKING', ids.op);
    java.calls.length = 0;

    const response = await call('post', `/inquiries/${id}/replies`, '/inquiries/{id}/replies', {
      body: { body: '확인했습니다. 곧 해결해 드릴게요.' },
    });

    expect(response.status).toBe(200);
    const detail = (await response.json()) as Record<string, any>;
    expect(detail.status).toBe('ANSWERED');
    const last = detail.messages.at(-1);
    expect(last).toMatchObject({ author: 'OPERATOR', authorName: names.op, body: '확인했습니다. 곧 해결해 드릴게요.' });
    expect(java.calls[0]).toMatchObject({
      method: 'POST',
      path: `/api/v0/platform-admin/inquiries/${id}/replies`,
      key: FAKE_JAVA_KEY,
      body: { memberId: ids.op, body: '확인했습니다. 곧 해결해 드릴게요.' },
    });
    const logs = await logsOf(id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'INQUIRY_REPLIED', beforeValue: null, afterValue: null });

    const again = await call('post', `/inquiries/${id}/replies`, '/inquiries/{id}/replies', {
      body: { body: '이어서 답변' },
    });
    expect(again.status).toBe(200);
    expect(await logsOf(id)).toHaveLength(2);
  });

  test('replies must be 1 to 500 characters and not only whitespace', async () => {
    const id = await newInquiry('CHECKING', ids.op);
    const reply = (body: unknown) =>
      call('post', `/inquiries/${id}/replies`, '/inquiries/{id}/replies', { body: body as object });

    for (const body of [{}, { body: '' }, { body: '   ' }, { body: '\n\n' }, { body: 'a'.repeat(501) }, { body: 7 }]) {
      const response = await reply(body);
      expect(response.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect((await response.json()).code).toBe('INQUIRY_REPLY_INVALID');
    }
    expect((await reply({ body: 'a'.repeat(500) })).status).toBe(200);
  });

  test('a member who is not the assignee cannot reply, and nothing is saved or recorded', async () => {
    const id = await newInquiry('CHECKING', ids.other);

    const response = await call('post', `/inquiries/${id}/replies`, '/inquiries/{id}/replies', {
      body: { body: '제가 답변할게요' },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('INQUIRY_ASSIGNEE_CHANGED');
    expect(await fixture.messages(id)).toHaveLength(1);
    expect((await fixture.inquiry(id)).status).toBe('CHECKING');
    expect(await logsOf(id)).toHaveLength(0);
  });

  test('replying to a resolved inquiry is rejected', async () => {
    const id = await newInquiry('RESOLVED', ids.op);

    const response = await call('post', `/inquiries/${id}/replies`, '/inquiries/{id}/replies', {
      body: { body: '늦은 답변' },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('INQUIRY_RESOLVED');
  });

  // ---------- Java 호출 실패

  test('a Java server error becomes a common 500 and records no change', async () => {
    const id = await newInquiry('WAITING');
    java.failNextWith(500);

    const response = await fetch(`${baseUrl}/api/v0/admin/inquiries/${id}/assignee`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: cookies.op, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedAssigneeId: null }),
    });

    expect(response.status).toBe(500);
    expect(contract.checkSchema('Error', await response.json())).toEqual([]);
    expect(await logsOf(id)).toHaveLength(0);
    expect((await fixture.inquiry(id)).assignee_member_id).toBeNull();
  });

  // ---------- 변경 이력 기록 실패 (Java 쓰기는 이미 끝난 뒤라 되돌릴 수 없다)

  test('a transient failure while recording the change is retried and the change is recorded once', async () => {
    const id = await newInquiry('WAITING');
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const transaction = vi
      .spyOn(database.db, 'transaction')
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockRejectedValueOnce(new Error('connection lost'));

    try {
      const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
        body: { expectedAssigneeId: null },
      });

      expect(response.status).toBe(200);
      expect(transaction).toHaveBeenCalledTimes(3);
      expect(await logsOf(id)).toHaveLength(1);
      expect(logged).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
      logged.mockRestore();
    }
  });

  test('when every retry fails the request still succeeds and the log has what is needed to fill the record in by hand', async () => {
    const id = await newInquiry('WAITING');
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const transaction = vi.spyOn(database.db, 'transaction').mockRejectedValue(new Error('connection lost'));

    try {
      const response = await call('post', `/inquiries/${id}/assignee`, '/inquiries/{id}/assignee', {
        body: { expectedAssigneeId: null },
      });

      // 문의는 이미 바뀌었으므로 화면에는 성공을 알린다(실패로 보이면 운영자가 다시 눌러 중복이 생길 수 있다).
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id, status: 'CHECKING', assignee: { id: ids.op } });
      expect(transaction).toHaveBeenCalledTimes(3);
      expect(await logsOf(id)).toHaveLength(0);

      expect(logged).toHaveBeenCalledTimes(1);
      const [message, stack] = logged.mock.calls[0]!;
      expect(String(message)).toContain('변경 이력');
      expect(JSON.parse(String(message).slice(String(message).indexOf('{')))).toEqual({
        inquiryId: id,
        actorMemberId: ids.op,
        action: 'INQUIRY_ASSIGNED',
        from: null,
        to: expect.stringContaining(names.op),
      });
      expect(String(stack)).toContain('connection lost');
    } finally {
      transaction.mockRestore();
      logged.mockRestore();
    }
  });
});
