import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { addDays, kstNow, todayInKst } from '../../src/common/time.js';
import { maskBusinessNumber, maskEmail, maskPhone } from '../../src/service-admin/masking.js';
import {
  membersQuerySchema,
  overviewQuerySchema,
  verificationsQuerySchema,
} from '../../src/service-admin/service-admin.schemas.js';
import { ServiceAdminService } from '../../src/service-admin/service-admin.service.js';
import type { ServiceMembersReader } from '../../src/service-admin/members-reader.js';
import type { ServiceOverviewReader } from '../../src/service-admin/overview-reader.js';
import type { ServiceSchoolsReader } from '../../src/service-admin/schools-reader.js';
import type { ServiceVerificationsReader } from '../../src/service-admin/verifications-reader.js';

describe('masking (기존 어드민 규칙)', () => {
  test('email keeps two characters of the local part', () => {
    expect(maskEmail('minjun@example.com')).toBe('mi****@example.com');
    expect(maskEmail('ab@example.com')).toBe('ab*@example.com');
    expect(maskEmail('a@example.com')).toBe('a*@example.com');
  });
  test('missing or malformed values are null, not empty strings', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('')).toBeNull();
    expect(maskBusinessNumber(undefined)).toBeNull();
  });
  test('phone shows the first three and last four digits', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskPhone('01012345678')).toBe('010-****-5678');
    expect(maskPhone('12345')).toBe('***');
  });
  test('Seoul numbers keep their two-digit area code', () => {
    expect(maskPhone('02-123-4567')).toBe('02-****-4567');
    expect(maskPhone('0212345678')).toBe('02-****-5678');
    expect(maskPhone('031-123-4567')).toBe('031-****-4567');
  });
  test('business number shows the first three and last five digits', () => {
    expect(maskBusinessNumber('123-45-67890')).toBe('123-**-67890');
    expect(maskBusinessNumber('1234567890')).toBe('123-**-67890');
    expect(maskBusinessNumber('123')).toBe('***');
  });
});

describe('KST helpers', () => {
  test('uses the KST calendar day around midnight', () => {
    expect(kstNow(new Date('2026-10-31T14:59:59Z'))).toEqual({ date: '2026-10-31', dateTime: '2026-10-31 23:59:59' });
    expect(kstNow(new Date('2026-10-31T15:00:00Z'))).toEqual({ date: '2026-11-01', dateTime: '2026-11-01 00:00:00' });
    expect(todayInKst(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01');
  });
  test('adds calendar days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-01-01', -29)).toBe('2025-12-03');
  });
});

describe('query validation', () => {
  test('applies documented defaults and ranges', () => {
    expect(overviewQuerySchema.parse({})).toEqual({ days: 30 });
    expect(overviewQuerySchema.safeParse({ days: '6' }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ days: '91' }).success).toBe(false);
    expect(membersQuerySchema.parse({})).toEqual({ page: 1, size: 20 });
    expect(membersQuerySchema.safeParse({ size: '101' }).success).toBe(false);
    expect(membersQuerySchema.safeParse({ type: 'owner' }).success).toBe(false);
    expect(membersQuerySchema.parse({ keyword: '  ' })).toEqual({ page: 1, size: 20 });
    expect(verificationsQuerySchema.safeParse({ status: 'UNKNOWN' }).success).toBe(false);
  });
});

function serviceWith(readers: { overview?: unknown; members?: unknown; schools?: unknown; verifications?: unknown }) {
  const as = <T>(read: string, fn: unknown) => ({ [read]: fn }) as unknown as T;
  return new ServiceAdminService(
    as<ServiceOverviewReader>('read', readers.overview),
    as<ServiceMembersReader>('list', readers.members),
    as<ServiceSchoolsReader>('list', readers.schools),
    as<ServiceVerificationsReader>('list', readers.verifications)
  );
}

describe('ServiceAdminService', () => {
  const statsRow = {
    totalUsers: 5,
    activeUsers: '5',
    withdrawnUsers: '0',
    guardians: 2,
    newUsers7d: null,
    newUsers30d: '1',
    activeOwners: 1,
    revokedOwners: 2,
    newOwners7d: null,
    totalSchools: 7,
    activeSchools: '3',
    closedSchools: '4',
    managedSchools: 1,
  };

  test('computes windows in KST and fills days without signups with zero', async () => {
    const overview = vi.fn(async () => ({
      stats: statsRow,
      verificationCounts: [{ status: 'REVOKED', count: '6' }],
      signupTrend: [{ date: '2026-10-30', count: '2' }],
      recentVerifications: [
        {
          id: 7,
          nickname: null,
          userId: 'u7',
          kindergartenName: '유치원',
          status: 'SUBMITTED',
          submittedAt: '2026-10-30 12:00:00.000000',
        },
      ],
    }));
    const result = await serviceWith({ overview }).overview({ days: 7 }, new Date('2026-10-31T15:30:00Z'));

    // UTC로는 10-31 15:30이지만 KST로는 11-01 00:30이다.
    expect(overview).toHaveBeenCalledWith({
      since7d: '2026-10-25 00:30:00',
      since30d: '2026-10-02 00:30:00',
      trendFrom: '2026-10-26',
    });
    expect(result.signupTrend).toEqual([
      { date: '2026-10-26', count: 0 },
      { date: '2026-10-27', count: 0 },
      { date: '2026-10-28', count: 0 },
      { date: '2026-10-29', count: 0 },
      { date: '2026-10-30', count: 2 },
      { date: '2026-10-31', count: 0 },
      { date: '2026-11-01', count: 0 },
    ]);
    expect(result.stats).toMatchObject({ activeUsers: 5, newUsers7d: 0, newUsers30d: 1, closedSchools: 4 });
    expect(result.stats.verificationCounts).toEqual({ REVOKED: 6 });
    expect(result.recentVerifications[0]).toMatchObject({ submittedAt: '2026-10-30T03:00:00.000Z' });
  });

  test('every overview statistic is an integer', async () => {
    const overview = vi.fn(async () => ({
      stats: statsRow,
      verificationCounts: [],
      signupTrend: [],
      recentVerifications: [],
    }));
    const { stats } = await serviceWith({ overview }).overview({ days: 30 });
    const { verificationCounts, ...numbers } = stats;
    expect(verificationCounts).toEqual({});
    for (const value of Object.values(numbers)) expect(Number.isInteger(value)).toBe(true);
  });

  test('members are masked, converted to UTC, and paged', async () => {
    const members = vi.fn(async () => ({
      total: 41,
      rows: [
        {
          id: 10,
          userId: 'abc',
          name: '김민준',
          status: 'ACTIVE',
          phone: '010-1234-5678',
          email: 'minjun@example.com',
          createdAt: '2026-09-08 00:45:00.672877',
          updatedAt: '2026-09-08 00:45:00.000000',
          petCount: '2',
          ownerRoleId: null,
          ownerGrantedAt: null,
          ownerRevokedAt: null,
          ownerRevokeReason: null,
          schoolId: null,
          schoolName: null,
          schoolStatus: null,
        },
        {
          id: 11,
          userId: 'def',
          name: '이름 미등록',
          status: 'ACTIVE',
          phone: null,
          email: null,
          createdAt: '2026-09-09 09:00:00.000000',
          updatedAt: '2026-09-09 09:00:00.000000',
          petCount: 0,
          ownerRoleId: 3,
          ownerGrantedAt: '2026-09-09 10:00:00.000000',
          ownerRevokedAt: null,
          ownerRevokeReason: null,
          schoolId: 5,
          schoolName: '유치원',
          schoolStatus: 'ACTIVE',
        },
      ],
    }));
    const result = await serviceWith({ members }).members({ page: 2, size: 20 });
    expect(result).toMatchObject({ page: 2, size: 20, totalItems: 41, totalPages: 3 });
    expect(result.items[0]).toMatchObject({
      phone: '010-****-5678',
      email: 'mi****@example.com',
      createdAt: '2026-09-07T15:45:00.672Z',
      petCount: 2,
      isGuardian: true,
      isOwner: false,
    });
    expect(result.items[1]).toMatchObject({
      phone: null,
      email: null,
      isGuardian: false,
      isOwner: true,
      ownerGrantedAt: '2026-09-09T01:00:00.000Z',
    });
    expect(result.items[0]).not.toHaveProperty('ownerRoleId');
  });

  test('only defined filters reach the reader', async () => {
    const members = vi.fn(async () => ({ total: 0, rows: [] }));
    await serviceWith({ members }).members({ page: 1, size: 20, type: 'OWNER' });
    expect(members).toHaveBeenCalledWith({ type: 'OWNER' }, expect.objectContaining({ page: 1, size: 20 }));
    expect((await serviceWith({ members }).members({ page: 1, size: 20 })).totalPages).toBe(0);
  });

  test('school and verification fields are masked and nullable values stay null', async () => {
    const schools = vi.fn(async () => ({
      total: 1,
      rows: [
        {
          id: 1,
          name: '유치원',
          address: '서울',
          addressDetail: null,
          phone: '02-123-4567',
          status: 'CLOSED',
          createdAt: '2026-10-07 23:02:47.928811',
          kindergartenPlaceId: null,
          ownerName: '원장 미연결',
          ownerUserId: null,
          ownerGrantedAt: null,
          activeMembers: '3',
          pendingMembers: null,
          businessVerified: '1',
        },
      ],
    }));
    const school = (await serviceWith({ schools }).schools({ page: 1, size: 20 })).items[0]!;
    expect(school).toMatchObject({
      phone: '02-****-4567',
      activeMembers: 3,
      pendingMembers: 0,
      businessVerified: true,
    });

    const verifications = vi.fn(async () => ({
      total: 1,
      rows: [
        {
          id: 4,
          userId: 'u',
          userName: null,
          schoolId: null,
          kindergartenPlaceId: null,
          kindergartenType: null,
          status: 'REVOKED',
          kindergartenName: null,
          kindergartenAddress: null,
          kindergartenAddressDetail: null,
          kindergartenPhone: '031-123-4567',
          representativeName: null,
          representativePhone: null,
          businessRegistrationNumber: '123-45-67890',
          submittedAt: null,
          revokedAt: '2026-08-25 11:16:32.580523',
          ownerGrantedAt: null,
          ownerRevokedAt: null,
          ownerRevokeReason: null,
        },
      ],
    }));
    const verification = (await serviceWith({ verifications }).verifications({ page: 1, size: 20 })).items[0]!;
    expect(verification).toMatchObject({
      userName: '이름 미등록',
      kindergartenPhone: '031-****-4567',
      representativePhone: null,
      businessRegistrationNumber: '123-**-67890',
      submittedAt: null,
      revokedAt: '2026-08-25T02:16:32.580Z',
    });
  });
});
