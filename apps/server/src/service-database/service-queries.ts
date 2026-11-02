import { sql } from 'drizzle-orm';
import { serviceUsers, socialUsers } from './service-schema.js';

// 서비스 DB를 읽는 기능(문의·제안)이 함께 쓰는 조회 도우미다.

// 사용자 이름·이메일은 소셜 가입 정보에서 가져온다. 이름이 없으면 닉네임을 쓴다. `user` 테이블이 조인된 쿼리에서만 쓸 수 있다.
export const userNameSql = () =>
  sql<
    string | null
  >`coalesce((select ${socialUsers.name} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1), ${serviceUsers.nickname})`;
export const userEmailSql = () =>
  sql<
    string | null
  >`(select ${socialUsers.email} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1)`;
