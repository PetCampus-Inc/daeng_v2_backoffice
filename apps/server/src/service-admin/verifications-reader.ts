import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { escapeLike, whereAll } from '../common/sql.js';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import type { Paged, PageRequest } from './paging.js';
import { queryRows } from './query-rows.js';
import { VERIFICATIONS_FROM, VERIFICATIONS_ORDER } from './verification-sql.js';

// 기존 어드민(daeng-admin)의 조회 SQL을 옮겼다. 서비스 DB는 읽기 전용 계정으로만 연결한다(ADR 0009).
// 시각은 KST 문자열로 오고 SUM()은 문자열이다. 변환은 서비스 계층이 한다. 사용자 입력은 모두 바인딩 파라미터이고 정렬·열 이름은 고정이다.

export interface VerificationRow {
  id: number;
  userId: string;
  userName: string | null;
  schoolId: number | null;
  kindergartenPlaceId: string | null;
  kindergartenType: string | null;
  status: string;
  kindergartenName: string | null;
  kindergartenAddress: string | null;
  kindergartenAddressDetail: string | null;
  kindergartenPhone: string | null;
  representativeName: string | null;
  representativePhone: string | null;
  businessRegistrationNumber: string | null;
  submittedAt: string | null;
  revokedAt: string | null;
  ownerGrantedAt: string | null;
  ownerRevokedAt: string | null;
  ownerRevokeReason: string | null;
}

@Injectable()
export class ServiceVerificationsReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  async list(
    filter: { status?: string; keyword?: string },
    { page, size }: PageRequest
  ): Promise<Paged<VerificationRow>> {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(sql`ov.status = ${filter.status}`);
    if (filter.keyword) {
      const like = `%${escapeLike(filter.keyword)}%`;
      conditions.push(
        sql`(ov.kindergarten_name LIKE ${like} OR ov.representative_name LIKE ${like} OR u.user_id LIKE ${like})`
      );
    }
    const clause = whereAll(conditions);
    const [count] = await queryRows<{ total: number | string }>(
      this.service,
      sql`SELECT COUNT(*) AS total ${VERIFICATIONS_FROM} ${clause}`
    );
    const rows = await queryRows<VerificationRow>(
      this.service,
      sql`
      SELECT
        ov.owner_verification_id AS id,
        u.user_id AS userId,
        COALESCE(NULLIF(u.guardian_name, ''), NULLIF(u.nickname, ''), ov.representative_name) AS userName,
        ov.school_id_fk AS schoolId,
        ov.kindergarten_place_id AS kindergartenPlaceId,
        ov.kindergarten_type AS kindergartenType,
        ov.status,
        ov.kindergarten_name AS kindergartenName,
        ov.kindergarten_address AS kindergartenAddress,
        ov.kindergarten_address_detail AS kindergartenAddressDetail,
        ov.kindergarten_phone_number AS kindergartenPhone,
        ov.representative_name AS representativeName,
        ov.representative_phone_number AS representativePhone,
        ov.business_registration_number AS businessRegistrationNumber,
        ov.submitted_at AS submittedAt,
        ov.revoked_at AS revokedAt,
        usr.created_at AS ownerGrantedAt,
        usr.revoked_at AS ownerRevokedAt,
        usr.revoke_reason AS ownerRevokeReason
      ${VERIFICATIONS_FROM}
      ${clause}
      ${VERIFICATIONS_ORDER}
      LIMIT ${size} OFFSET ${(page - 1) * size}
    `
    );
    return { total: Number(count?.total ?? 0), rows };
  }
}
