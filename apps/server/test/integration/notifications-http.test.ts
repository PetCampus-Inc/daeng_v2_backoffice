import 'reflect-metadata';
import { Module, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { NotificationsController } from '../../src/notifications/notifications.controller.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';
const item = {
  id: 1,
  kind: 'NEW_INQUIRY',
  message: '새 문의',
  targetType: 'INQUIRY',
  targetId: 2,
  createdAt: '2026-10-30T00:00:00.000Z',
  readAt: null,
};
const service = {
  list: vi.fn().mockResolvedValue({ items: [item], page: 1, size: 20, totalItems: 1, totalPages: 1 }),
  unreadCount: vi.fn().mockResolvedValue({ count: 1 }),
  read: vi.fn().mockResolvedValue(item),
  readAll: vi.fn().mockResolvedValue(undefined),
};
class AuthenticationStub {
  canActivate(context: { switchToHttp(): { getRequest(): { member: unknown } } }) {
    context.switchToHttp().getRequest().member = { id: 12 };
    return true;
  }
}
class TestModule {}
Module({
  controllers: [NotificationsController],
  providers: [
    { provide: NotificationsService, useValue: service },
    { provide: APP_GUARD, useClass: AuthenticationStub },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})(TestModule);
let app: INestApplication;
let base: string;
let spec: OpenApiContract;
beforeAll(async () => {
  spec = await OpenApiContract.load();
  app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
});
afterAll(async () => {
  await app.close();
});
describe('notification HTTP API', () => {
  test('list, unread count, read and read-all comply with OpenAPI and use the authenticated ID', async () => {
    const list = await fetch(`${base}/notifications`);
    await expectMatchesSpec(spec, list, { method: 'get', path: '/notifications' });
    expect(service.list).toHaveBeenCalledWith(12, 1, 20);
    const count = await fetch(`${base}/notifications/unread-count`);
    await expectMatchesSpec(spec, count, { method: 'get', path: '/notifications/unread-count' });
    const read = await fetch(`${base}/notifications/1/read`, { method: 'POST' });
    await expectMatchesSpec(spec, read, { method: 'post', path: '/notifications/{id}/read' });
    expect(service.read).toHaveBeenCalledWith(12, 1);
    const all = await fetch(`${base}/notifications/read-all`, { method: 'POST' });
    await expectMatchesSpec(spec, all, { method: 'post', path: '/notifications/read-all' });
    expect(service.readAll).toHaveBeenCalledWith(12);
  });
  test('invalid pagination and IDs return documented validation errors', async () => {
    const list = await fetch(`${base}/notifications?page=0`);
    expect(list.status).toBe(400);
    await expectMatchesSpec(spec, list, { method: 'get', path: '/notifications' });
    const read = await fetch(`${base}/notifications/invalid/read`, { method: 'POST' });
    expect(read.status).toBe(400);
    await expectMatchesSpec(spec, read, { method: 'post', path: '/notifications/{id}/read' });
  });
});
