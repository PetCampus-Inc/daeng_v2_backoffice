import { eq } from 'drizzle-orm';
import type { Database } from './database.service.js';
import { members } from './schema.js';

function isDuplicateEntry(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (cause as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY';
}

/**
 * 같은 이메일의 팀원이 없을 때만 최고 관리자를 등록하고 등록했는지 알려 준다. 이미 있으면 아무것도 바꾸지 않는다.
 * 첫 로그인 때 활성화된다(등록됨 상태로 시작).
 */
export async function ensureInitialSuperAdmin(db: Database, email: string): Promise<boolean> {
  const [existing] = await db.select({ id: members.id }).from(members).where(eq(members.email, email)).limit(1);
  if (existing) return false;
  try {
    await db.insert(members).values({ email, role: 'SUPER_ADMIN', status: 'REGISTERED' });
    return true;
  } catch (error) {
    // 서버가 동시에 여러 대 켜져 다른 쪽이 먼저 등록한 경우
    if (isDuplicateEntry(error)) return false;
    throw error;
  }
}
