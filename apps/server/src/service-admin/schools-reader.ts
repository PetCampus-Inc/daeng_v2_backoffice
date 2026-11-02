import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { escapeLike, whereAll } from '../common/sql.js';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import type { Paged, PageRequest } from './paging.js';
import { queryRows } from './query-rows.js';

// 기존 어드민(daeng-admin)의 조회 SQL을 옮겼다. 서비스 DB는 읽기 전용 계정으로만 연결한다(ADR 0009).
// 시각은 KST 문자열로 오고 SUM()은 문자열이다. 변환은 서비스 계층이 한다. 사용자 입력은 모두 바인딩 파라미터이고 정렬·열 이름은 고정이다.

export interface SchoolRow {
  id: number;
  name: string;
  address: string;
  addressDetail: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  kindergartenPlaceId: string | null;
  ownerName: string;
  ownerUserId: string | null;
  ownerGrantedAt: string | null;
  activeMembers: number | string;
  pendingMembers: number | string;
  businessVerified: number | string;
}

const SCHOOLS_BASE = sql`
  SELECT
    s.school_id AS id,
    s.name,
    s.address,
    s.address_detail AS addressDetail,
    s.phone_number AS phone,
    s.status,
    s.created_at AS createdAt,
    s.kindergarten_place_id AS kindergartenPlaceId,
    COALESCE(NULLIF(u.guardian_name, ''), NULLIF(u.nickname, ''), '원장 미연결') AS ownerName,
    u.user_id AS ownerUserId,
    usr.created_at AS ownerGrantedAt,
    COALESCE(m.active_members, 0) AS activeMembers,
    COALESCE(m.pending_members, 0) AS pendingMembers,
    CASE WHEN br.school_business_registration_id IS NULL THEN 0 ELSE 1 END AS businessVerified
  FROM tb_school s
  LEFT JOIN tb_user_school_role usr
    ON usr.school_id_fk = s.school_id AND usr.role = 'ROLE_OWNER' AND usr.revoked_at IS NULL
  LEFT JOIN \`user\` u ON u.id = usr.user_id_fk
  LEFT JOIN (
    SELECT school_id,
           SUM(status = 'ACTIVE') AS active_members,
           SUM(status = 'PENDING') AS pending_members
    FROM school_pet_membership GROUP BY school_id
  ) m ON m.school_id = s.school_id
  LEFT JOIN tb_school_business_registration br
    ON br.school_id_fk = s.school_id AND br.revoked_at IS NULL
`;

@Injectable()
export class ServiceSchoolsReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  async list(filter: { status?: string; keyword?: string }, { page, size }: PageRequest): Promise<Paged<SchoolRow>> {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(sql`school.status = ${filter.status}`);
    if (filter.keyword) {
      const like = `%${escapeLike(filter.keyword)}%`;
      conditions.push(sql`(school.name LIKE ${like} OR school.address LIKE ${like} OR school.ownerName LIKE ${like})`);
    }
    const clause = whereAll(conditions);
    const [count] = await queryRows<{ total: number | string }>(
      this.service,
      sql`SELECT COUNT(*) AS total FROM (${SCHOOLS_BASE}) school ${clause}`
    );
    const rows = await queryRows<SchoolRow>(
      this.service,
      sql`
      SELECT * FROM (${SCHOOLS_BASE}) school ${clause}
      ORDER BY school.createdAt DESC, school.id DESC
      LIMIT ${size} OFFSET ${(page - 1) * size}
    `
    );
    return { total: Number(count?.total ?? 0), rows };
  }
}
