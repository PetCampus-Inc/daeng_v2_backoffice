import { sql } from 'drizzle-orm';
import { serviceUsers, socialUsers } from './service-schema.js';

// 서비스 DB를 읽는 기능(문의·제안)이 함께 쓰는 조회 도우미다.

/** 서비스 DB의 KST 시각 문자열(`YYYY-MM-DD HH:mm:ss.ffffff`)을 UTC ISO 문자열로 바꾼다. */
export function kstToIso(value: string): string {
  return new Date(`${value.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}+09:00`).toISOString();
}

/** LIKE 패턴에서 `%`, `_`, `\`를 글자 그대로 찾도록 이스케이프한다. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

// 사용자 이름·이메일은 소셜 가입 정보에서 가져온다. 이름이 없으면 닉네임을 쓴다. `user` 테이블이 조인된 쿼리에서만 쓸 수 있다.
export const userNameSql = () =>
  sql<
    string | null
  >`coalesce((select ${socialUsers.name} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1), ${serviceUsers.nickname})`;
export const userEmailSql = () =>
  sql<
    string | null
  >`(select ${socialUsers.email} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1)`;
