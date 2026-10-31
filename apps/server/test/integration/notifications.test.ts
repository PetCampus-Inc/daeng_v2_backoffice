import 'reflect-metadata';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { DatabaseService } from '../../src/database/database.service.js';
import { members, notifications, processedNotificationEvents } from '../../src/database/schema.js';
import { NotificationEventProcessor } from '../../src/notifications/notification-event-processor.js';
import { NotificationEventClient } from '../../src/notifications/notification-event-client.js';
import { NotificationEventPoller } from '../../src/notifications/notification-event-poller.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { hasDatabase, readTestDatabaseConfig } from '../support/test-database.js';

const run = `notice-test-${Date.now()}`;
const eventIds = [
  '9007199254740001',
  '9007199254740002',
  '9007199254740003',
  '9007199254740004',
  '9007199254740005',
  '9007199254740006',
];
const event = {
  eventId: eventIds[0]!,
  schemaVersion: 1 as const,
  type: 'NEW_INQUIRY' as const,
  targetType: 'INQUIRY' as const,
  targetId: 123,
  messageId: null,
  previousAssigneeId: null,
  actorMemberId: null,
  occurredAt: '2026-10-30T03:00:00Z',
};
describe.skipIf(!hasDatabase)('notification storage and processing', () => {
  let db: DatabaseService;
  let service: NotificationsService;
  let processor: NotificationEventProcessor;
  let operatorId: number;
  let viewerId: number;
  beforeAll(async () => {
    db = new DatabaseService(readTestDatabaseConfig());
    service = new NotificationsService(db);
    processor = new NotificationEventProcessor(db);
    await db.db.insert(members).values([
      { email: `${run}-op@example.com`, role: 'OPERATOR', status: 'ACTIVE' },
      { email: `${run}-viewer@example.com`, role: 'VIEWER', status: 'ACTIVE' },
    ]);
    const rows = await db.db
      .select()
      .from(members)
      .where(inArray(members.email, [`${run}-op@example.com`, `${run}-viewer@example.com`]));
    operatorId = rows.find((m) => m.role === 'OPERATOR')!.id;
    viewerId = rows.find((m) => m.role === 'VIEWER')!.id;
  });
  afterAll(async () => {
    if (!db) return;
    await db.db.delete(notifications).where(inArray(notifications.eventId, eventIds));
    await db.db.delete(processedNotificationEvents).where(inArray(processedNotificationEvents.eventId, eventIds));
    await db.db.delete(members).where(inArray(members.email, [`${run}-op@example.com`, `${run}-viewer@example.com`]));
    await db.onApplicationShutdown();
  });
  test('stores exactly once even under concurrent duplicate delivery and snapshots recipients', async () => {
    await Promise.all([processor.process(event), processor.process(event)]);
    const rows = await db.db.select().from(notifications).where(eq(notifications.eventId, event.eventId));
    expect(rows.filter((row) => row.recipientId === operatorId)).toHaveLength(1);
    expect(rows.filter((row) => row.recipientId === viewerId)).toHaveLength(0);
    await db.db.update(members).set({ role: 'OPERATOR' }).where(eq(members.id, viewerId));
    await processor.process(event);
    expect(
      (await db.db.select().from(notifications).where(eq(notifications.eventId, event.eventId))).filter(
        (row) => row.recipientId === viewerId
      )
    ).toHaveLength(0);
  });
  test('read state is per recipient and repeat reads keep the original timestamp', async () => {
    const page = await service.list(operatorId, 1, 20);
    const item = page.items.find((n) => n.targetId === 123)!;
    expect(item.readAt).toBeNull();
    expect(await service.unreadCount(operatorId)).toEqual({ count: 1 });
    await expect(service.read(viewerId, item.id)).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    const read = await service.read(operatorId, item.id);
    expect(read.readAt).not.toBeNull();
    expect((await service.read(operatorId, item.id)).readAt).toBe(read.readAt);
    expect(await service.unreadCount(operatorId)).toEqual({ count: 0 });
  });
  test('rolls back a missing actor and snapshots the change message on success', async () => {
    const change = {
      ...event,
      eventId: eventIds[1]!,
      type: 'ASSIGNEE_CHANGED' as const,
      previousAssigneeId: viewerId,
      actorMemberId: operatorId,
    };
    await expect(processor.process(change)).rejects.toThrow('profile');
    expect(
      await db.db
        .select()
        .from(processedNotificationEvents)
        .where(eq(processedNotificationEvents.eventId, change.eventId))
    ).toHaveLength(0);
    await db.db.update(members).set({ displayName: '운영자', jobRole: 'BE' }).where(eq(members.id, operatorId));
    await processor.process(change);
    await db.db.update(members).set({ displayName: '새이름' }).where(eq(members.id, operatorId));
    const [stored] = await db.db.select().from(notifications).where(eq(notifications.eventId, change.eventId));
    expect(stored).toMatchObject({ recipientId: viewerId, message: '운영자 · BE님이 문의의 담당자를 변경했습니다.' });
  });
  test('marks a zero-recipient event as processed so later activation cannot add recipients', async () => {
    await db.db
      .update(members)
      .set({ status: 'INACTIVE' })
      .where(inArray(members.id, [operatorId, viewerId]));
    const noRecipients = { ...event, eventId: eventIds[2]! };
    await processor.process(noRecipients);
    await db.db.update(members).set({ status: 'ACTIVE' }).where(eq(members.id, operatorId));
    await processor.process(noRecipients);
    // DB에 다른 활성 계정이 있을 수 있으므로 이 테스트가 만든 계정만 본다.
    expect(
      (await db.db.select().from(notifications).where(eq(notifications.eventId, noRecipients.eventId))).filter((row) =>
        [operatorId, viewerId].includes(row.recipientId)
      )
    ).toHaveLength(0);
    expect(
      await db.db
        .select()
        .from(processedNotificationEvents)
        .where(eq(processedNotificationEvents.eventId, noRecipients.eventId))
    ).toHaveLength(1);
  });
  test('persists once across a failed Java completion and subsequent redelivery', async () => {
    const delivery = { ...event, eventId: eventIds[3]! };
    // Java는 이벤트 ID를 JSON 숫자로 보낸다.
    const wire = { ...delivery, eventId: Number(delivery.eventId) };
    const fake = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { items: [wire], nextAfterId: null } }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { items: [wire], nextAfterId: null } }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fake);
    const client = new NotificationEventClient({ baseUrl: 'http://java.test', apiKey: 'test' });
    const poller = new NotificationEventPoller(client, processor);
    try {
      await poller.poll();
      await poller.poll();
      expect(fake).toHaveBeenCalledTimes(4);
      expect(
        (await db.db.select().from(notifications).where(eq(notifications.eventId, delivery.eventId))).filter(
          (row) => row.recipientId === operatorId
        )
      ).toHaveLength(1);
      expect(
        await db.db
          .select()
          .from(processedNotificationEvents)
          .where(eq(processedNotificationEvents.eventId, delivery.eventId))
      ).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test('finishes a change event for an inactive recipient even when the actor profile is missing', async () => {
    await db.db.update(members).set({ status: 'INACTIVE' }).where(eq(members.id, viewerId));
    const change = {
      ...event,
      eventId: eventIds[4]!,
      type: 'ASSIGNEE_CHANGED' as const,
      previousAssigneeId: viewerId,
      actorMemberId: 999999,
    };
    await processor.process(change);
    expect(
      await db.db
        .select()
        .from(processedNotificationEvents)
        .where(eq(processedNotificationEvents.eventId, change.eventId))
    ).toHaveLength(1);
    expect(await db.db.select().from(notifications).where(eq(notifications.eventId, change.eventId))).toHaveLength(0);
  });
  test('read-all marks only the caller unread notifications and keeps earlier read times', async () => {
    await db.db
      .update(members)
      .set({ status: 'ACTIVE' })
      .where(inArray(members.id, [operatorId, viewerId]));
    await processor.process({
      ...event,
      eventId: eventIds[5]!,
      type: 'NEW_IDEA' as const,
      targetType: 'IDEA' as const,
      targetId: 456,
    });
    const earlier = (await service.list(operatorId, 1, 100)).items.find((n) => n.readAt !== null)!;
    expect(earlier.readAt).not.toBeNull();
    expect((await service.unreadCount(operatorId)).count).toBeGreaterThan(0);
    const viewerUnread = (await service.unreadCount(viewerId)).count;
    expect(viewerUnread).toBeGreaterThan(0);

    await service.readAll(operatorId);

    expect(await service.unreadCount(operatorId)).toEqual({ count: 0 });
    expect(await service.unreadCount(viewerId)).toEqual({ count: viewerUnread });
    const after = (await service.list(operatorId, 1, 100)).items.find((n) => n.id === earlier.id)!;
    expect(after.readAt).toBe(earlier.readAt);
    await service.readAll(operatorId);
    expect(await service.unreadCount(operatorId)).toEqual({ count: 0 });
  });
});
