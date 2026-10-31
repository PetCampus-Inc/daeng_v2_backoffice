import 'reflect-metadata';
import { afterEach, expect, test, vi } from 'vitest';
import { JavaApiClient } from '../../src/java-api/java-api.client.js';
import { NotificationEventClient } from '../../src/notifications/notification-event-client.js';
const client = new NotificationEventClient(new JavaApiClient({ baseUrl: 'https://java.test', apiKey: 'secret' }));
afterEach(() => vi.unstubAllGlobals());
test('uses the agreed event endpoints and sends the API key', async () => {
  const fake = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [], nextAfterId: null } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fake);
  expect(await client.list('123')).toEqual({ items: [], nextAfterId: null });
  await client.complete('123');
  expect(fake.mock.calls[0]![0]).toBe(
    'https://java.test/api/v0/platform-admin/bo-notification-events?limit=50&afterId=123'
  );
  expect(fake.mock.calls[0]![1].headers['X-Backoffice-Api-Key']).toBe('secret');
  expect(fake.mock.calls[1]![0]).toBe('https://java.test/api/v0/platform-admin/bo-notification-events/complete');
  expect(JSON.parse(fake.mock.calls[1]![1].body)).toEqual({ eventIds: [123] });
});
test('does not accept malformed pages or acknowledge rejected completion', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { items: [], nextAfterId: 'not-an-id' } }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
  );
  await expect(client.list()).rejects.toThrow();
  await expect(client.complete('1')).rejects.toThrow('404');
});
test('reads numeric Java event ids as strings', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [], nextAfterId: 123 } }), { status: 200 }))
  );
  expect(await client.list()).toEqual({ items: [], nextAfterId: '123' });
});
test('rejects string and unsafe numeric event ids', async () => {
  for (const nextAfterId of ['123', 9007199254740992]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [], nextAfterId } }), { status: 200 }))
    );
    await expect(client.list()).rejects.toThrow();
  }
});
