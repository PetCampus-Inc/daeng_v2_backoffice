import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service.js';
import { members, type MemberRole } from '../../src/database/schema.js';
import { ServiceAdminController } from '../../src/service-admin/service-admin.controller.js';
import { ServiceAdminService } from '../../src/service-admin/service-admin.service.js';
import { ServiceMembersReader } from '../../src/service-admin/service-members-reader.js';
import { ServiceOverviewReader } from '../../src/service-admin/service-overview-reader.js';
import { ServiceSchoolsReader } from '../../src/service-admin/service-schools-reader.js';
import { ServiceVerificationsReader } from '../../src/service-admin/service-verifications-reader.js';
import {
  SERVICE_DATABASE_CONFIG,
  ServiceDatabaseService,
} from '../../src/service-database/service-database.service.js';
import { ORIGIN, startAuthApp } from '../support/auth-app.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
import { ServiceAdminFixture, type FixtureUser } from '../support/service-admin-fixture.js';
import { deleteTestRun, hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const RUN = `vitest-svc-${Date.now()}`;
const email = (name: string) => `${RUN}-${name}@example.com`;
// 이름·검색어에 쓰는 짧은 태그(보호자 이름 열이 20자 제한이다).
const TAG = `S${String(Date.now()).slice(-8)}`;
// 서비스 DB는 KST 문자열로 시각을 저장한다. 시험 데이터는 모두 과거 날짜라 실제 시각의 다른 시험 데이터와 섞이지 않는다.
const NOW = new Date('2026-03-15T03:00:00Z'); // KST 2026-03-15 12:00

describe.skipIf(!hasDatabase)('service admin views (real database, fake service data)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;
  let contract: OpenApiContract;
  let fixture: ServiceAdminFixture;
  let service: ServiceAdminService;
  let baseline: Awaited<ReturnType<ServiceAdminService['overview']>>;
  const cookies = {} as Record<'admin' | 'viewer', string>;
  const ids = {} as Record<'s1' | 's2' | 'v1' | 'v2' | 'v3', number>;
  let guardian: FixtureUser;

  const get = async (path: string, specPath: string, cookie: string | null = cookies.viewer) => {
    const response = await fetch(`${baseUrl}/api/v0/admin${path}`, {
      headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    });
    await expectMatchesSpec(contract, response, { method: 'get', path: specPath });
    return response;
  };
  const json = async (path: string, specPath: string) => (await get(path, specPath)).json();

  const addMember = async (name: string, role: MemberRole) => {
    await database.db.insert(members).values({
      email: email(name),
      role,
      status: 'ACTIVE',
      displayName: `서${Date.now() % 100_000}${name.length}`,
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

  beforeAll(async () => {
    contract = await OpenApiContract.load();
    const config = readTestDatabaseConfig();
    fixture = await ServiceAdminFixture.create(config);
    ({ app, baseUrl, database } = await startAuthApp(config, email, undefined, {
      controllers: [ServiceAdminController],
      providers: [
        { provide: SERVICE_DATABASE_CONFIG, useValue: config },
        ServiceDatabaseService,
        ServiceOverviewReader,
        ServiceMembersReader,
        ServiceSchoolsReader,
        ServiceVerificationsReader,
        ServiceAdminService,
      ],
    }));
    service = app.get(ServiceAdminService, { strict: false });
    await addMember('admin', 'SUPER_ADMIN');
    await addMember('viewer', 'VIEWER');
    cookies.admin = await signIn('admin');
    cookies.viewer = await signIn('viewer');

    // 시험 데이터를 넣기 전의 지표. 학교·역할·인증·반려견 테이블은 이 시험만 쓰므로 증감이 정확하다.
    baseline = await service.overview({ days: 7 }, NOW);

    guardian = await fixture.addUser({
      label: 'g1',
      guardianName: `${TAG}-가디언`,
      phone: '010-1111-2222',
      email: `${RUN}-g1@example.com`,
      createdAt: '2026-03-10 09:00:00',
    });
    await fixture.addPet(guardian.pk);
    await fixture.addPet(guardian.pk, '2026-03-11 00:00:00'); // 삭제된 반려견은 세지 않는다
    const owner = await fixture.addUser({ label: 'o1', nickname: `${TAG}-원장`, createdAt: '2026-03-11 09:00:00' });
    await fixture.addUser({
      label: 'w1',
      nickname: `${TAG}-탈퇴`,
      status: 'WITHDRAWN',
      createdAt: '2026-03-12 09:00:00',
    });
    const regranted = await fixture.addUser({
      label: 'r1',
      nickname: `${TAG}-재부여`,
      createdAt: '2026-03-05 09:00:00',
    });

    ids.s1 = await fixture.addSchool({ name: `${TAG}-학교1`, phone: '02-123-4567', createdAt: '2026-03-11 10:00:00' });
    ids.s2 = await fixture.addSchool({ name: `${TAG}-학교2`, status: 'CLOSED', createdAt: '2026-03-12 10:00:00' });
    await fixture.addMembership(ids.s1, 'ACTIVE');
    await fixture.addMembership(ids.s1, 'ACTIVE');
    await fixture.addMembership(ids.s1, 'PENDING');
    await fixture.addBusinessRegistration(ids.s1);
    await fixture.addRole(owner.pk, ids.s1, { createdAt: '2026-03-11 09:30:00' });
    // 원장 역할을 해지했다가 다시 부여한 뒤 다시 해지: 같은 (회원, 학교)에 역할 행이 둘이다.
    await fixture.addRole(regranted.pk, ids.s2, {
      createdAt: '2026-03-01 09:00:00',
      revokedAt: '2026-03-02 09:00:00',
      reason: '첫 해지',
    });
    await fixture.addRole(regranted.pk, ids.s2, {
      createdAt: '2026-03-05 09:00:00',
      revokedAt: '2026-03-20 09:00:00',
      reason: '최종 해지',
    });

    ids.v1 = await fixture.addVerification({
      userPk: owner.pk,
      schoolId: ids.s1,
      status: 'SUBMITTED',
      kindergartenName: `${TAG}-인증1`,
      submittedAt: '2026-03-11 09:30:00',
      businessNumber: '123-45-67890',
      phone: '010-9999-8888',
    });
    ids.v2 = await fixture.addVerification({
      userPk: regranted.pk,
      schoolId: ids.s2,
      status: 'REVOKED',
      kindergartenName: `${TAG}-인증2`,
      submittedAt: '2026-03-05 09:30:00',
    });
    ids.v3 = await fixture.addVerification({
      userPk: guardian.pk,
      status: 'KINDERGARTEN_INFO_COMPLETED',
      kindergartenName: `${TAG}-인증3`,
      submittedAt: null,
    });
  });

  afterAll(async () => {
    await fixture?.cleanup();
    await fixture?.close();
    if (database) await deleteTestRun(database, RUN);
    await app?.close();
  });

  describe('access', () => {
    test('every role can read, anonymous requests are rejected', async () => {
      expect((await get('/service-admin/members?keyword=zzz', '/service-admin/members', cookies.admin)).status).toBe(
        200
      );
      expect((await get('/service-admin/members?keyword=zzz', '/service-admin/members', cookies.viewer)).status).toBe(
        200
      );
      expect((await get('/service-admin/members', '/service-admin/members', null)).status).toBe(401);
    });

    test('invalid queries are validation errors', async () => {
      for (const query of ['days=6', 'days=91']) {
        expect((await get(`/service-admin/overview?${query}`, '/service-admin/overview')).status).toBe(400);
      }
      expect((await get('/service-admin/members?size=101', '/service-admin/members')).status).toBe(400);
      expect((await get('/service-admin/members?type=owner', '/service-admin/members')).status).toBe(400);
      expect((await get('/service-admin/schools?status=OPEN', '/service-admin/schools')).status).toBe(400);
    });
  });

  describe('members', () => {
    test('lists newest first with masked contact info and derived flags', async () => {
      const page = await json(`/service-admin/members?keyword=${TAG}`, '/service-admin/members');
      expect(page).toMatchObject({ page: 1, size: 20, totalItems: 4, totalPages: 1 });
      expect(page.items.map((item: { name: string }) => item.name)).toEqual([
        `${TAG}-탈퇴`,
        `${TAG}-원장`,
        `${TAG}-가디언`,
        `${TAG}-재부여`,
      ]);
      const [, ownerRow, guardianRow] = page.items;
      const local = `${RUN}-g1`;
      const expectedEmail = `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@example.com`;
      expect(guardianRow).toMatchObject({
        phone: '010-****-2222',
        email: expectedEmail,
        petCount: 1,
        isGuardian: true,
        isOwner: false,
        createdAt: '2026-03-10T00:00:00.000Z',
      });
      expect(ownerRow).toMatchObject({
        phone: null,
        email: null,
        isOwner: true,
        isGuardian: false,
        schoolName: `${TAG}-학교1`,
        schoolStatus: 'ACTIVE',
        ownerGrantedAt: '2026-03-11T00:30:00.000Z',
        ownerRevokedAt: null,
      });
    });

    test('filters by type', async () => {
      const names = async (type: string) =>
        (await json(`/service-admin/members?keyword=${TAG}&type=${type}`, '/service-admin/members')).items.map(
          (item: { name: string }) => item.name
        );
      expect(await names('GUARDIAN')).toEqual([`${TAG}-가디언`]);
      expect(await names('OWNER')).toEqual([`${TAG}-원장`]); // 해지된 역할은 원장이 아니다
      expect(await names('WITHDRAWN')).toEqual([`${TAG}-탈퇴`]);
    });

    test('finds email and phone only by their full value, not by a part', async () => {
      const ids = async (keyword: string) =>
        (
          await json(`/service-admin/members?keyword=${encodeURIComponent(keyword)}`, '/service-admin/members')
        ).items.map((item: { id: number }) => item.id);
      const fullEmail = `${RUN}-g1@example.com`;
      const [found] = await ids(fullEmail);
      expect(found).toBeDefined();
      expect(await ids(fullEmail.toUpperCase())).toEqual([found]); // 대소문자 무시
      expect(await ids(fullEmail.slice(0, -4))).toEqual([]); // 마스킹된 값을 부분 검색으로 추측할 수 없다
      expect(await ids(`${RUN}-g1`)).toEqual([]);
      expect(await ids('010-1111-2222')).toEqual([found]);
      expect(await ids('01011112222')).toEqual([found]);
      expect(await ids('1111')).toEqual([]);
      expect(await ids('010-1111')).toEqual([]);
    });

    test('pages and treats % and _ in the keyword literally', async () => {
      const second = await json(`/service-admin/members?keyword=${TAG}&size=3&page=2`, '/service-admin/members');
      expect(second).toMatchObject({ page: 2, size: 3, totalItems: 4, totalPages: 2 });
      expect(second.items).toHaveLength(1);
      const wildcard = await json('/service-admin/members?keyword=%25', '/service-admin/members');
      expect(wildcard.totalItems).toBe(0);
      const underscore = await json('/service-admin/members?keyword=_', '/service-admin/members');
      expect(
        underscore.items.every((item: { name: string; userId: string }) => /_/.test(`${item.name}${item.userId}`))
      ).toBe(true);
    });
  });

  describe('schools', () => {
    test('shows owner, member counts and verified business', async () => {
      const page = await json(`/service-admin/schools?keyword=${TAG}`, '/service-admin/schools');
      expect(page).toMatchObject({ totalItems: 2, totalPages: 1 });
      const [closed, active] = page.items;
      expect(active).toMatchObject({
        id: ids.s1,
        name: `${TAG}-학교1`,
        phone: '02-****-4567',
        status: 'ACTIVE',
        ownerName: `${TAG}-원장`,
        activeMembers: 2,
        pendingMembers: 1,
        businessVerified: true,
        createdAt: '2026-03-11T01:00:00.000Z',
      });
      expect(closed).toMatchObject({
        id: ids.s2,
        status: 'CLOSED',
        ownerName: '원장 미연결',
        ownerUserId: null,
        activeMembers: 0,
        businessVerified: false,
      });
    });

    test('filters by status', async () => {
      const page = await json(`/service-admin/schools?keyword=${TAG}&status=CLOSED`, '/service-admin/schools');
      expect(page.items.map((item: { id: number }) => item.id)).toEqual([ids.s2]);
    });
  });

  describe('verifications', () => {
    test('lists every verification once, unsubmitted first, then newest submission', async () => {
      const page = await json(`/service-admin/verifications?keyword=${TAG}`, '/service-admin/verifications');
      // 같은 (회원, 학교)에 역할 행이 둘이어도 인증 한 건이 한 줄이다.
      expect(page).toMatchObject({ totalItems: 3, totalPages: 1 });
      expect(page.items.map((item: { id: number }) => item.id)).toEqual([ids.v3, ids.v1, ids.v2]);
      const [unsubmitted, submitted, regranted] = page.items;
      expect(unsubmitted).toMatchObject({ status: 'KINDERGARTEN_INFO_COMPLETED', submittedAt: null, schoolId: null });
      expect(submitted).toMatchObject({
        kindergartenPhone: '010-****-8888',
        representativePhone: '010-****-8888',
        businessRegistrationNumber: '123-**-67890',
        submittedAt: '2026-03-11T00:30:00.000Z',
        ownerGrantedAt: '2026-03-11T00:30:00.000Z',
      });
      // 가장 최근에 부여한 역할 행을 쓴다.
      expect(regranted).toMatchObject({
        ownerGrantedAt: '2026-03-05T00:00:00.000Z',
        ownerRevokedAt: '2026-03-20T00:00:00.000Z',
        ownerRevokeReason: '최종 해지',
      });
    });

    test('filters by status and pages without repeating rows', async () => {
      const revoked = await json(
        `/service-admin/verifications?keyword=${TAG}&status=REVOKED`,
        '/service-admin/verifications'
      );
      expect(revoked.items.map((item: { id: number }) => item.id)).toEqual([ids.v2]);
      const seen: number[] = [];
      for (const page of [1, 2, 3]) {
        const result = await json(
          `/service-admin/verifications?keyword=${TAG}&size=1&page=${page}`,
          '/service-admin/verifications'
        );
        expect(result).toMatchObject({ totalItems: 3, totalPages: 3 });
        seen.push(...result.items.map((item: { id: number }) => item.id));
      }
      expect(seen).toEqual([ids.v3, ids.v1, ids.v2]);
    });
  });

  describe('overview', () => {
    test('matches the spec', async () => {
      const response = await get('/service-admin/overview?days=30', '/service-admin/overview');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.signupTrend).toHaveLength(30);
      expect(body.recentVerifications.length).toBeLessThanOrEqual(6);
    });

    test('counts only what the fixtures added', async () => {
      const after = await service.overview({ days: 7 }, NOW);
      const delta = (key: keyof typeof after.stats & keyof typeof baseline.stats) =>
        (after.stats[key] as number) - (baseline.stats[key] as number);
      expect(delta('totalSchools')).toBe(2);
      expect(delta('activeSchools')).toBe(1);
      expect(delta('closedSchools')).toBe(1);
      expect(delta('managedSchools')).toBe(1);
      expect(delta('activeOwners')).toBe(1);
      expect(delta('revokedOwners')).toBe(1);
      expect(delta('guardians')).toBe(1);
      const counts = (overview: typeof after) => overview.stats.verificationCounts as Record<string, number>;
      for (const status of ['SUBMITTED', 'REVOKED', 'KINDERGARTEN_INFO_COMPLETED']) {
        expect((counts(after)[status] ?? 0) - (counts(baseline)[status] ?? 0)).toBe(1);
      }
    });

    test('recent verifications put unsubmitted first', async () => {
      const { recentVerifications } = await service.overview({ days: 7 }, NOW);
      expect(recentVerifications.slice(0, 3).map((item) => item.id)).toEqual([ids.v3, ids.v1, ids.v2]);
    });

    test('signup trend uses KST days and always has one entry per day', async () => {
      await fixture.addUser({ label: 'edge', createdAt: '2026-03-15 00:30:00' }); // UTC로는 3월 14일
      await fixture.addUser({ label: 'before', createdAt: '2026-03-14 23:59:59' });
      const { signupTrend } = await service.overview({ days: 7 }, NOW);
      expect(signupTrend.map((point) => point.date)).toEqual([
        '2026-03-09',
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
        '2026-03-13',
        '2026-03-14',
        '2026-03-15',
      ]);
      const countOn = (date: string) => signupTrend.find((point) => point.date === date)!.count;
      expect(countOn('2026-03-15')).toBe(1); // 00:30 KST
      expect(countOn('2026-03-14')).toBe(1); // 23:59:59 KST
      expect(countOn('2026-03-10')).toBe(1); // 보호자
      expect(countOn('2026-03-13')).toBe(0); // 가입자가 없는 날도 0으로 나온다
    });

    test('the 7-day window is inclusive at the KST boundary', async () => {
      await fixture.addUser({ label: 'in', createdAt: '2026-03-09 12:00:00' });
      await fixture.addUser({ label: 'out', createdAt: '2026-03-09 11:59:59' });
      // 기준 시각이 하루 차이인 두 호출의 차이는 그 사이(03-08 12:00 이상 03-09 12:00 미만)에 가입한 회원이다.
      const earlier = await service.overview({ days: 7 }, new Date('2026-03-15T03:00:00Z'));
      const later = await service.overview({ days: 7 }, new Date('2026-03-16T03:00:00Z'));
      expect((earlier.stats.newUsers7d as number) - (later.stats.newUsers7d as number)).toBe(1);
    });
  });
});
