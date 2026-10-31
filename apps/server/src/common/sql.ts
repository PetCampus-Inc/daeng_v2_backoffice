import { sql, type SQL } from 'drizzle-orm';

/** LIKE 패턴에 넣을 값의 `\`·`%`·`_`를 글자 그대로 찾도록 이스케이프한다. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** 조건이 있으면 `WHERE a AND b`, 없으면 빈 조각. */
export const whereAll = (conditions: SQL[]) =>
  conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
