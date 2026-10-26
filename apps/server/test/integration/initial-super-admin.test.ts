import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { DatabaseService } from '../../src/database/database.service.js';
import { ensureInitialSuperAdmin } from '../../src/database/initial-super-admin.js';
import { members } from '../../src/database/schema.js';
import { hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const EMAIL = `vitest-${Date.now()}@example.com`;

describe.skipIf(!hasDatabase)('initial super admin (real database)', () => {
  let service: DatabaseService;

  beforeAll(() => {
    service = new DatabaseService(readTestDatabaseConfig());
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
