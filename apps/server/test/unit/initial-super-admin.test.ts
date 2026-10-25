import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readDatabaseConfig } from '../../src/config.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { ensureInitialSuperAdmin } from '../../src/database/initial-super-admin.js';
import { members } from '../../src/database/schema.js';

// 로컬 DB에 마이그레이션이 적용돼 있을 때만 돈다: infisical run --env=dev -- pnpm test:unit
const hasDatabase = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every((name) => process.env[name]);
const EMAIL = `vitest-${Date.now()}@example.com`;

describe.skipIf(!hasDatabase)('initial super admin (real database)', () => {
  let service: DatabaseService;

  beforeAll(() => {
    service = new DatabaseService(
      readDatabaseConfig({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      })
    );
  });

  afterAll(async () => {
    await service.db.delete(members).where(eq(members.email, EMAIL));
    await service.onApplicationShutdown();
  });

  test('registers once and never changes an existing member', async () => {
    expect(await ensureInitialSuperAdmin(service.db, EMAIL)).toBe(true);
    await service.db.update(members).set({ role: 'VIEWER', status: 'ACTIVE' }).where(eq(members.email, EMAIL));

    const [before] = await service.db.select().from(members).where(eq(members.email, EMAIL));
    expect(await ensureInitialSuperAdmin(service.db, EMAIL)).toBe(false);
    const [row] = await service.db.select().from(members).where(eq(members.email, EMAIL));
    expect(row.updatedAt).toEqual(before.updatedAt);
    expect(row).toMatchObject({ role: 'VIEWER', status: 'ACTIVE', displayName: null, jobRole: null });
    expect(row.registeredAt).toBeInstanceOf(Date);
  });
});
