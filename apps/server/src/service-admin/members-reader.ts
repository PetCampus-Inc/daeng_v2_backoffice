import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { escapeLike, whereAll } from '../common/sql.js';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import type { Paged, PageRequest } from './paging.js';
import { queryRows } from './query-rows.js';

// 기존 어드민(daeng-admin)의 조회 SQL을 옮겼다. 서비스 DB는 읽기 전용 계정으로만 연결한다(ADR 0009).
// 시각은 KST 문자열로 오고 SUM()은 문자열이다. 변환은 서비스 계층이 한다. 사용자 입력은 모두 바인딩 파라미터이고 정렬·열 이름은 고정이다.

export interface MemberRow {
  id: number;
  userId: string;
  name: string;
  status: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  petCount: number | string;
  ownerRoleId: number | null;
  ownerGrantedAt: string | null;
  ownerRevokedAt: string | null;
  ownerRevokeReason: string | null;
  schoolId: number | null;
  schoolName: string | null;
  schoolStatus: string | null;
}

const MEMBERS_BASE = sql`
  SELECT
    u.id,
    u.user_id AS userId,
    COALESCE(NULLIF(u.guardian_name, ''), NULLIF(u.nickname, ''), su.name, '이름 미등록') AS name,
    u.status,
    u.phone_number AS phone,
    su.email,
    u.created_at AS createdAt,
    u.updated_at AS updatedAt,
    COALESCE(p.pet_count, 0) AS petCount,
    usr.user_school_role_id AS ownerRoleId,
    usr.created_at AS ownerGrantedAt,
    usr.revoked_at AS ownerRevokedAt,
    usr.revoke_reason AS ownerRevokeReason,
    s.school_id AS schoolId,
    s.name AS schoolName,
    s.status AS schoolStatus
  FROM \`user\` u
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS pet_count
    FROM pet WHERE removed_at IS NULL GROUP BY user_id
  ) p ON p.user_id = u.id
  LEFT JOIN (
    SELECT user_id, MAX(email) AS email, MAX(name) AS name
    FROM social_user WHERE status = 'LINKED' GROUP BY user_id
  ) su ON su.user_id = u.user_id
  LEFT JOIN tb_user_school_role usr
    ON usr.user_id_fk = u.id AND usr.role = 'ROLE_OWNER' AND usr.revoked_at IS NULL
  LEFT JOIN tb_school s ON s.school_id = usr.school_id_fk
`;

@Injectable()
export class ServiceMembersReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  async list(filter: { type?: string; keyword?: string }, { page, size }: PageRequest): Promise<Paged<MemberRow>> {
    const conditions: SQL[] = [];
    if (filter.type === 'GUARDIAN') conditions.push(sql`member.petCount > 0`);
    if (filter.type === 'OWNER') conditions.push(sql`member.ownerRoleId IS NOT NULL`);
    if (filter.type === 'WITHDRAWN') conditions.push(sql`member.status = 'WITHDRAWN'`);
    if (filter.keyword) {
      // 화면에서 마스킹한 이메일·전화번호는 부분 일치로 찾으면 마스킹된 값을 추측할 수 있다. 전체가 일치할 때만 찾는다.
      const like = `%${escapeLike(filter.keyword)}%`;
      const digits = filter.keyword.replace(/\D/g, '');
      const matches = [
        sql`member.userId LIKE ${like}`,
        sql`member.name LIKE ${like}`,
        sql`LOWER(member.email) = ${filter.keyword.toLowerCase()}`,
      ];
      if (digits) matches.push(sql`REPLACE(REPLACE(member.phone, '-', ''), ' ', '') = ${digits}`);
      conditions.push(sql`(${sql.join(matches, sql` OR `)})`);
    }
    const clause = whereAll(conditions);
    const [count] = await queryRows<{ total: number | string }>(
      this.service,
      sql`SELECT COUNT(*) AS total FROM (${MEMBERS_BASE}) member ${clause}`
    );
    const rows = await queryRows<MemberRow>(
      this.service,
      sql`
      SELECT * FROM (${MEMBERS_BASE}) member ${clause}
      ORDER BY member.createdAt DESC, member.id DESC
      LIMIT ${size} OFFSET ${(page - 1) * size}
    `
    );
    return { total: Number(count?.total ?? 0), rows };
  }
}
