import 'reflect-metadata';
import { type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { RoleGuard } from '../../src/auth/role.guard.js';
import { AccessLogService } from '../../src/auth/access-log.service.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { NoticesController } from '../../src/notices/notices.controller.js';
import { NoticesService } from '../../src/notices/notices.service.js';
import { TermVersionsController } from '../../src/terms/term-versions.controller.js';
import { TermsController } from '../../src/terms/terms.controller.js';
import { TermsService } from '../../src/terms/terms.service.js';

const notices = {
  list: vi.fn().mockResolvedValue({ items: [], page: 1, size: 20, totalItems: 0, totalPages: 0 }),
  create: vi.fn(),
};
const terms = { draftTemplate: vi.fn(), create: vi.fn() };
const accessLog = { record: vi.fn() };
class TestModule {}
Module({
  controllers: [NoticesController, TermsController, TermVersionsController],
  providers: [
    { provide: NoticesService, useValue: notices },
    { provide: TermsService, useValue: terms },
    { provide: AccessLogService, useValue: accessLog },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})(TestModule);
let app: INestApplication;
let base: string;
beforeAll(async () => {
  app = await NestFactory.create(TestModule, { logger: false });
  app.use((req: { headers: Record<string, string>; member?: unknown }, _res: unknown, next: () => void) => {
    req.member = { id: 1, email: 'test@example.com', role: req.headers['x-test-role'] };
    next();
  });
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
});
afterAll(async () => {
  await app.close();
});
const request = (path: string, role: string, method = 'GET', body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'x-test-role': role, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
describe('content HTTP authorization and validation', () => {
  test('viewer can list notices but cannot create one', async () => {
    expect((await request('/notices', 'VIEWER')).status).toBe(200);
    const denied = await request('/notices', 'VIEWER', 'POST', { title: '', body: '' });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(accessLog.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'ACCESS_DENIED' }));
  });
  test('operator cannot access terms draft creation', async () => {
    expect(
      (
        await request('/terms/SERVICE_TERMS/versions', 'OPERATOR', 'POST', {
          effectiveDate: '2026-11-01',
          content: '내용',
        })
      ).status
    ).toBe(403);
  });
  test('invalid date and image requests use their specified errors', async () => {
    const invalidDate = await request('/terms/SERVICE_TERMS/versions', 'SUPER_ADMIN', 'POST', {
      effectiveDate: '2026-02-30',
      content: '내용',
    });
    expect(await invalidDate.json()).toMatchObject({ code: 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT' });
    const invalidImage = await request('/notices/images/upload-urls', 'OPERATOR', 'POST', { files: [] });
    expect(await invalidImage.json()).toMatchObject({ code: 'NOTICE_IMAGE_INVALID' });
  });
});
