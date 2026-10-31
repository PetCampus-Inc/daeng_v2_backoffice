import { Inject, Injectable } from '@nestjs/common';
import { addDays, kstNow, kstToIso } from '../common/time.js';
import type { Paged } from './paging.js';
import { ServiceMembersReader, type MemberRow } from './service-members-reader.js';
import { ServiceOverviewReader } from './service-overview-reader.js';
import { ServiceSchoolsReader, type SchoolRow } from './service-schools-reader.js';
import { ServiceVerificationsReader, type VerificationRow } from './service-verifications-reader.js';
import { maskBusinessNumber, maskEmail, maskPhone } from './masking.js';
import type { MembersQuery, OverviewQuery, SchoolsQuery, VerificationsQuery } from './service-admin.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const count = (value: number | string | null | undefined) => Number(value ?? 0);
const iso = (value: string | null) => (value === null ? null : kstToIso(value));

function pageOf<T, R>(result: Paged<T>, query: { page: number; size: number }, map: (row: T) => R) {
  return {
    items: result.rows.map(map),
    page: query.page,
    size: query.size,
    totalItems: result.total,
    totalPages: Math.ceil(result.total / query.size),
  };
}

/** 서비스 DB 조회 결과를 BO 명세의 응답으로 바꾼다: 마스킹, 정수 변환, KST 시각의 UTC 변환. */
@Injectable()
export class ServiceAdminService {
  constructor(
    @Inject(ServiceOverviewReader) private readonly overviewReader: ServiceOverviewReader,
    @Inject(ServiceMembersReader) private readonly membersReader: ServiceMembersReader,
    @Inject(ServiceSchoolsReader) private readonly schoolsReader: ServiceSchoolsReader,
    @Inject(ServiceVerificationsReader) private readonly verificationsReader: ServiceVerificationsReader
  ) {}

  async overview({ days }: OverviewQuery, now: Date = new Date()) {
    const today = kstNow(now).date;
    const trendFrom = addDays(today, -(days - 1));
    const rows = await this.overviewReader.read({
      since7d: kstNow(new Date(now.getTime() - 7 * DAY_MS)).dateTime,
      since30d: kstNow(new Date(now.getTime() - 30 * DAY_MS)).dateTime,
      trendFrom,
    });
    const signups = new Map(rows.signupTrend.map((row) => [row.date, count(row.count)]));
    const { stats } = rows;
    return {
      stats: {
        totalUsers: count(stats.totalUsers),
        activeUsers: count(stats.activeUsers),
        withdrawnUsers: count(stats.withdrawnUsers),
        guardians: count(stats.guardians),
        newUsers7d: count(stats.newUsers7d),
        newUsers30d: count(stats.newUsers30d),
        activeOwners: count(stats.activeOwners),
        revokedOwners: count(stats.revokedOwners),
        newOwners7d: count(stats.newOwners7d),
        totalSchools: count(stats.totalSchools),
        activeSchools: count(stats.activeSchools),
        closedSchools: count(stats.closedSchools),
        managedSchools: count(stats.managedSchools),
        verificationCounts: Object.fromEntries(rows.verificationCounts.map((row) => [row.status, count(row.count)])),
      },
      // 가입자가 없는 날도 0으로 채워 항상 `days`개를 오래된 날부터 준다.
      signupTrend: Array.from({ length: days }, (_, index) => {
        const date = addDays(trendFrom, index);
        return { date, count: signups.get(date) ?? 0 };
      }),
      recentVerifications: rows.recentVerifications.map((row) => ({
        id: row.id,
        nickname: row.nickname,
        userId: row.userId,
        kindergartenName: row.kindergartenName,
        status: row.status,
        submittedAt: iso(row.submittedAt),
      })),
    };
  }

  async members(query: MembersQuery) {
    const result = await this.membersReader.list(
      { ...(query.type ? { type: query.type } : {}), ...(query.keyword ? { keyword: query.keyword } : {}) },
      query
    );
    return pageOf(result, query, (row: MemberRow) => {
      const petCount = count(row.petCount);
      return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        status: row.status,
        phone: maskPhone(row.phone),
        email: maskEmail(row.email),
        createdAt: kstToIso(row.createdAt),
        updatedAt: kstToIso(row.updatedAt),
        petCount,
        isGuardian: petCount > 0,
        isOwner: row.ownerRoleId !== null,
        ownerGrantedAt: iso(row.ownerGrantedAt),
        ownerRevokedAt: iso(row.ownerRevokedAt),
        ownerRevokeReason: row.ownerRevokeReason,
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        schoolStatus: row.schoolStatus,
      };
    });
  }

  async schools(query: SchoolsQuery) {
    const result = await this.schoolsReader.list(
      { ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { keyword: query.keyword } : {}) },
      query
    );
    return pageOf(result, query, (row: SchoolRow) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      addressDetail: row.addressDetail,
      phone: maskPhone(row.phone),
      status: row.status,
      createdAt: kstToIso(row.createdAt),
      kindergartenPlaceId: row.kindergartenPlaceId,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      ownerGrantedAt: iso(row.ownerGrantedAt),
      activeMembers: count(row.activeMembers),
      pendingMembers: count(row.pendingMembers),
      businessVerified: count(row.businessVerified) > 0,
    }));
  }

  async verifications(query: VerificationsQuery) {
    const result = await this.verificationsReader.list(
      { ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { keyword: query.keyword } : {}) },
      query
    );
    return pageOf(result, query, (row: VerificationRow) => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName ?? '이름 미등록',
      schoolId: row.schoolId,
      kindergartenPlaceId: row.kindergartenPlaceId,
      kindergartenType: row.kindergartenType,
      status: row.status,
      kindergartenName: row.kindergartenName,
      kindergartenAddress: row.kindergartenAddress,
      kindergartenAddressDetail: row.kindergartenAddressDetail,
      kindergartenPhone: maskPhone(row.kindergartenPhone),
      representativeName: row.representativeName,
      representativePhone: maskPhone(row.representativePhone),
      businessRegistrationNumber: maskBusinessNumber(row.businessRegistrationNumber),
      submittedAt: iso(row.submittedAt),
      revokedAt: iso(row.revokedAt),
      ownerGrantedAt: iso(row.ownerGrantedAt),
      ownerRevokedAt: iso(row.ownerRevokedAt),
      ownerRevokeReason: row.ownerRevokeReason,
    }));
  }
}
