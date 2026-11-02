import { inArray, like } from 'drizzle-orm';
import { readDatabaseConfig } from '../../src/database/database.config.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { accessLogs, members, sessions } from '../../src/database/schema.js';

/** 로컬 DB에 마이그레이션이 적용돼 있을 때만 DB 테스트가 돈다: infisical run --env=dev -- pnpm --filter @daeng/server test:integration */
export const hasDatabase = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every(
  (name) => process.env[name]
);

export function readTestDatabaseConfig() {
  return readDatabaseConfig({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

/**
 * 이 실행이 만든 팀원·세션·접속 기록을 지운다. `runPrefix`로 시작하는 이메일만 대상이다
 * (접속 기록은 원래 추가만 하는 테이블이라 테스트가 만든 것만 지운다).
 */
export async function deleteTestRun({ db }: DatabaseService, runPrefix: string): Promise<void> {
  const mine = await db
    .select({ id: members.id })
    .from(members)
    .where(like(members.email, `${runPrefix}%`));
  if (mine.length > 0) {
    const ids = mine.map((m) => m.id);
    await db.delete(sessions).where(inArray(sessions.memberId, ids));
    await db.delete(members).where(inArray(members.id, ids));
  }
  await db.delete(accessLogs).where(like(accessLogs.email, `${runPrefix}%`));
}
