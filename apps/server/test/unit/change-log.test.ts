import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import type { ChangeLogReader, ChangeLogRow } from '../../src/change-log/change-log-reader.js';
import { changeLogsQuerySchema } from '../../src/change-log/change-log.schemas.js';
import { ChangeLogService } from '../../src/change-log/change-log.service.js';
import { addDays, kstStartOfDay } from '../../src/common/time.js';

const row = (overrides: Partial<ChangeLogRow> = {}): ChangeLogRow => ({
  id: 7,
  occurredAt: new Date('2026-10-30T03:00:00.000Z'),
  actorMemberId: 3,
  actorEmail: 'admin@example.com',
  actorDisplayName: '관리자',
  actorJobRole: 'BE',
  targetType: 'ACCOUNT',
  targetId: 9,
  targetLabel: 'member@example.com',
  action: 'ACCOUNT_ROLE_CHANGED',
  beforeValue: 'OPERATOR',
  afterValue: 'VIEWER',
  ...overrides,
});

describe('KST day boundaries', () => {
  test('a KST date starts at 15:00 UTC the day before', () => {
    expect(kstStartOfDay('2026-03-15').toISOString()).toBe('2026-03-14T15:00:00.000Z');
    expect(kstStartOfDay(addDays('2026-03-15', 1)).toISOString()).toBe('2026-03-15T15:00:00.000Z');
    expect(kstStartOfDay('2026-01-01').toISOString()).toBe('2025-12-31T15:00:00.000Z');
  });
});

describe('query validation', () => {
  test('defaults and bounds', () => {
    expect(changeLogsQuerySchema.parse({})).toEqual({ page: 1, size: 20 });
    expect(changeLogsQuerySchema.parse({ actorId: '5', targetType: 'NOTICE', size: '100' })).toMatchObject({
      actorId: 5,
      targetType: 'NOTICE',
      size: 100,
    });
    for (const bad of [
      { size: '101' },
      { page: '0' },
      { actorId: '0' },
      { targetType: 'INQUIRIES' },
      { from: '2026-02-30' },
      { to: '2026/03/01' },
    ]) {
      expect(changeLogsQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
  test('the start date cannot be after the end date', () => {
    expect(changeLogsQuerySchema.safeParse({ from: '2026-03-15', to: '2026-03-14' }).success).toBe(false);
    expect(changeLogsQuerySchema.safeParse({ from: '2026-03-15', to: '2026-03-15' }).success).toBe(true);
    expect(changeLogsQuerySchema.safeParse({ from: '2026-03-15' }).success).toBe(true);
  });
});

describe('ChangeLogService', () => {
  const serviceWith = (rows: ChangeLogRow[], total = rows.length) =>
    new ChangeLogService({ list: vi.fn(async () => ({ total, rows })) } as unknown as ChangeLogReader);

  test('maps the stored snapshot to the API shape', async () => {
    const result = await serviceWith([row()], 41).list({ page: 3, size: 20 });
    expect(result).toMatchObject({ page: 3, size: 20, totalItems: 41, totalPages: 3 });
    expect(result.items[0]).toEqual({
      id: 7,
      occurredAt: '2026-10-30T03:00:00.000Z',
      actor: { id: 3, displayName: '관리자', jobRole: 'BE', email: 'admin@example.com' },
      targetType: 'ACCOUNT',
      target: { id: 9, label: 'member@example.com' },
      action: 'ACCOUNT_ROLE_CHANGED',
      change: { from: 'OPERATOR', to: 'VIEWER' },
    });
  });

  test('change is null without before/after values and keeps a null side', async () => {
    const { items } = await serviceWith([
      row({ beforeValue: null, afterValue: null, action: 'NOTICE_EDITED', targetType: 'NOTICE' }),
      row({ beforeValue: null, afterValue: '운영자', action: 'INQUIRY_ASSIGNED', targetType: 'INQUIRY' }),
    ]).list({ page: 1, size: 20 });
    expect(items[0]!.change).toBeNull();
    expect(items[1]!.change).toEqual({ from: null, to: '운영자' });
  });

  test('an empty result has zero pages', async () => {
    expect(await serviceWith([]).list({ page: 1, size: 20 })).toMatchObject({
      items: [],
      totalItems: 0,
      totalPages: 0,
    });
  });
});
