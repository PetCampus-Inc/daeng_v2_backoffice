import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { NotificationEventPoller } from '../../src/notifications/notification-event-poller.js';
import type { NotificationEventClient } from '../../src/notifications/notification-event-client.js';
import type { NotificationEventProcessor } from '../../src/notifications/notification-event-processor.js';

// Java는 이벤트 ID를 JSON 숫자로 보낸다.
const event = (eventId: number) => ({
  eventId,
  schemaVersion: 1,
  type: 'NEW_INQUIRY',
  targetType: 'INQUIRY',
  targetId: 1,
  messageId: null,
  previousAssigneeId: null,
  actorMemberId: null,
  occurredAt: '2026-10-30T03:00:00Z',
});
function create() {
  const client = { list: vi.fn(), complete: vi.fn() };
  const processor = { process: vi.fn() };
  const poller = new NotificationEventPoller(
    client as unknown as NotificationEventClient,
    processor as unknown as NotificationEventProcessor
  );
  vi.spyOn((poller as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(
    () => undefined
  );
  return { client, processor, poller };
}
describe('notification event polling', () => {
  test('continues past a failed event, advances pages, and restarts the next sweep', async () => {
    const { client, processor, poller } = create();
    client.list
      .mockResolvedValueOnce({ items: [event(1)], nextAfterId: '1' })
      .mockResolvedValueOnce({ items: [event(2)], nextAfterId: null })
      .mockResolvedValueOnce({ items: [], nextAfterId: null });
    processor.process.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
    await poller.poll();
    await poller.poll();
    expect(client.list.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, '1', undefined]);
    expect(client.complete.mock.calls).toEqual([['2']]);
  });
  test('retries completion after BO commit when Java acknowledgment failed', async () => {
    const { client, processor, poller } = create();
    client.list.mockResolvedValue({ items: [event(1)], nextAfterId: null });
    client.complete.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(undefined);
    await poller.poll();
    await poller.poll();
    expect(processor.process).toHaveBeenCalledTimes(2);
    expect(client.complete).toHaveBeenCalledTimes(2);
  });
  test('does not acknowledge unknown schema versions', async () => {
    const { client, processor, poller } = create();
    client.list.mockResolvedValue({ items: [{ ...event(1), schemaVersion: 2 }], nextAfterId: null });
    await poller.poll();
    expect(processor.process).not.toHaveBeenCalled();
    expect(client.complete).not.toHaveBeenCalled();
  });
});
