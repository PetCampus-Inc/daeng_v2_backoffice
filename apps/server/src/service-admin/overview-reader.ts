import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import { queryRows } from './query-rows.js';
import { VERIFICATIONS_ORDER } from './verification-sql.js';

// 기존 어드민(daeng-admin)의 조회 SQL을 옮겼다. 서비스 DB는 읽기 전용 계정으로만 연결한다(ADR 0009).
// 시각은 KST 문자열로 오고 SUM()은 문자열이다. 변환은 서비스 계층이 한다. 사용자 입력은 모두 바인딩 파라미터이고 정렬·열 이름은 고정이다.

export interface OverviewStatsRow {
  totalUsers: number | string;
  activeUsers: number | string | null;
  withdrawnUsers: number | string | null;
  guardians: number | string;
  newUsers7d: number | string | null;
  newUsers30d: number | string | null;
  activeOwners: number | string;
  revokedOwners: number | string;
  newOwners7d: number | string | null;
  totalSchools: number | string;
  activeSchools: number | string | null;
  closedSchools: number | string | null;
  managedSchools: number | string;
}

export interface RecentVerificationRow {
  id: number;
  nickname: string | null;
  userId: string;
  kindergartenName: string | null;
  status: string;
  submittedAt: string | null;
}

export interface OverviewRows {
  stats: OverviewStatsRow;
  verificationCounts: Array<{ status: string; count: number | string }>;
  signupTrend: Array<{ date: string; count: number | string }>;
  recentVerifications: RecentVerificationRow[];
}

/** KST 기준 값. `since*`는 `YYYY-MM-DD HH:mm:ss`, `trendFrom`은 `YYYY-MM-DD`다. */
export interface OverviewWindow {
  since7d: string;
  since30d: string;
  trendFrom: string;
}

@Injectable()
export class ServiceOverviewReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  private rows<T>(query: ReturnType<typeof sql>) {
    return queryRows<T>(this.service, query);
  }

  async read(window: OverviewWindow): Promise<OverviewRows> {
    const [stats, owners, schools, verificationCounts, signupTrend, recentVerifications] = await Promise.all([
      this.rows<
        Pick<
          OverviewStatsRow,
          'totalUsers' | 'activeUsers' | 'withdrawnUsers' | 'guardians' | 'newUsers7d' | 'newUsers30d'
        >
      >(sql`
        SELECT
          COUNT(*) AS totalUsers,
          SUM(u.status = 'ACTIVE') AS activeUsers,
          SUM(u.status = 'WITHDRAWN') AS withdrawnUsers,
          COUNT(DISTINCT CASE WHEN u.status = 'ACTIVE' AND p.user_id IS NOT NULL THEN u.id END) AS guardians,
          SUM(u.created_at >= ${window.since7d}) AS newUsers7d,
          SUM(u.created_at >= ${window.since30d}) AS newUsers30d
        FROM \`user\` u
        LEFT JOIN (SELECT DISTINCT user_id FROM pet WHERE removed_at IS NULL) p ON p.user_id = u.id
      `),
      this.rows<Pick<OverviewStatsRow, 'activeOwners' | 'revokedOwners' | 'newOwners7d'>>(sql`
        SELECT
          COUNT(DISTINCT CASE
            WHEN usr.revoked_at IS NULL AND usr.role = 'ROLE_OWNER' AND u.status = 'ACTIVE' THEN usr.user_id_fk END) AS activeOwners,
          COUNT(DISTINCT CASE
            WHEN usr.revoked_at IS NOT NULL AND usr.role = 'ROLE_OWNER' THEN usr.user_id_fk END) AS revokedOwners,
          SUM(usr.role = 'ROLE_OWNER' AND usr.revoked_at IS NULL AND usr.created_at >= ${window.since7d}) AS newOwners7d
        FROM tb_user_school_role usr
        JOIN \`user\` u ON u.id = usr.user_id_fk
      `),
      this.rows<Pick<OverviewStatsRow, 'totalSchools' | 'activeSchools' | 'closedSchools' | 'managedSchools'>>(sql`
        SELECT
          COUNT(*) AS totalSchools,
          SUM(status = 'ACTIVE') AS activeSchools,
          SUM(status = 'CLOSED') AS closedSchools,
          COUNT(DISTINCT CASE WHEN usr.user_school_role_id IS NOT NULL THEN s.school_id END) AS managedSchools
        FROM tb_school s
        LEFT JOIN tb_user_school_role usr
          ON usr.school_id_fk = s.school_id AND usr.role = 'ROLE_OWNER' AND usr.revoked_at IS NULL
      `),
      this.rows<{ status: string; count: number | string }>(
        sql`SELECT status, COUNT(*) AS count FROM tb_owner_verification GROUP BY status`
      ),
      this.rows<{ date: string; count: number | string }>(sql`
        SELECT DATE(created_at) AS date, COUNT(*) AS count
        FROM \`user\`
        WHERE created_at >= ${window.trendFrom}
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
      this.rows<RecentVerificationRow>(sql`
        SELECT
          ov.owner_verification_id AS id,
          u.nickname,
          u.user_id AS userId,
          ov.kindergarten_name AS kindergartenName,
          ov.status,
          ov.submitted_at AS submittedAt
        FROM tb_owner_verification ov
        JOIN \`user\` u ON u.id = ov.user_id_fk
        ${VERIFICATIONS_ORDER}
        LIMIT 6
      `),
    ]);
    return {
      stats: { ...stats[0]!, ...owners[0]!, ...schools[0]! },
      verificationCounts,
      signupTrend,
      recentVerifications,
    };
  }
}
