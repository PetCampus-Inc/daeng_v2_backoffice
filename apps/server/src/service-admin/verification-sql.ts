import { sql } from 'drizzle-orm';

// 원장 인증 목록(`verifications`)과 개요의 최근 인증이 같은 조인·정렬을 쓴다.

// 원장 역할을 해지했다가 다시 부여하면 같은 (회원, 학교)에 역할 행이 여러 개다. 조인이 행을 늘리지 않게 가장 최근 부여 건 하나만 쓴다.
export const VERIFICATIONS_FROM = sql`
  FROM tb_owner_verification ov
  JOIN \`user\` u ON u.id = ov.user_id_fk
  LEFT JOIN tb_user_school_role usr
    ON usr.user_school_role_id = (
      SELECT r.user_school_role_id
      FROM tb_user_school_role r
      WHERE r.user_id_fk = u.id AND r.school_id_fk = ov.school_id_fk AND r.role = 'ROLE_OWNER'
      ORDER BY r.created_at DESC, r.user_school_role_id DESC
      LIMIT 1
    )
`;

// 제출 전(제출 시각 없음) 건을 먼저, 그다음 제출 시각 최신순이다. 같으면 ID 내림차순이다.
export const VERIFICATIONS_ORDER = sql`ORDER BY (ov.submitted_at IS NULL) DESC, ov.submitted_at DESC, ov.owner_verification_id DESC`;
