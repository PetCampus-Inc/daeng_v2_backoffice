import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import { type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { AccessLogService } from '../../src/auth/access-log.service.js';
import { RoleGuard } from '../../src/auth/role.guard.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { JAVA_API_CONFIG, JavaApiClient } from '../../src/java-api/java-api.client.js';
import { NoticeJavaClient } from '../../src/notices/notice-java.client.js';
import { NoticesController } from '../../src/notices/notices.controller.js';
import { NoticesService } from '../../src/notices/notices.service.js';
import { TermVersionsController } from '../../src/terms/term-versions.controller.js';
import { TermsController } from '../../src/terms/terms.controller.js';
import { TermsJavaClient } from '../../src/terms/terms-java.client.js';
import { TermsService } from '../../src/terms/terms.service.js';
import { expectMatchesSpec, OpenApiContract } from '../support/openapi-contract.js';

let java: Server;
let app: INestApplication;
let base: string;
let contract: OpenApiContract;
const changes: Array<Record<string, unknown>> = [];
let failLog = false;
let writes = 0;
let terms = {
  id: 9,
  title: '서비스 이용약관',
  type: 'TERMS_OF_SERVICE',
  body: { schemaVersion: 1, blocks: [{ type: 'p', children: [{ text: '약관 본문' }] }] },
  status: 'DRAFT',
  effectiveDate: '2099-11-20',
  announcedDate: null as string | null,
  publishedAt: null as string | null,
  createdAt: '2026-10-20T12:00:00',
  updatedAt: '2026-10-20T12:00:00',
  rowVersion: 1,
};
let notice = {
  id: 1,
  title: '공지',
  body: { schemaVersion: 1, blocks: [{ type: 'p', children: [{ text: '본문' }] }] },
  previewBody: { schemaVersion: 1, blocks: [{ type: 'p', children: [{ text: '본문' }] }] },
  status: 'DRAFT',
  publishedAt: null as string | null,
  createdAt: '2026-10-20T12:00:00',
  updatedAt: '2026-10-20T12:00:00',
  rowVersion: 1,
};
const database = {
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      if (failLog) throw new Error('test database failure');
      await fn({
        insert: () => ({
          values: (value: Record<string, unknown>) => {
            changes.push(value);
          },
        }),
      });
    },
  },
};

beforeAll(async () => {
  contract = await OpenApiContract.load();
  java = createServer(async (req, res) => {
    if (req.headers['x-backoffice-api-key'] !== 'test-key') {
      res.writeHead(401).end();
      return;
    }
    const path = new URL(req.url!, 'http://localhost');
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as { rowVersion: number }) : undefined;
    if (path.pathname.startsWith('/api/v0/platform-admin/legal-documents/')) {
      let error: string | undefined;
      if (path.pathname.endsWith('/publication') && req.method === 'PUT') {
        if (body?.rowVersion !== terms.rowVersion) error = 'PLATFORM-409-1';
        else if (!terms.effectiveDate) error = 'PLATFORM-409-7';
        else if (terms.effectiveDate === '2000-01-01') error = 'PLATFORM-409-14';
        else
          terms = {
            ...terms,
            status: 'PUBLISHED',
            announcedDate: '2026-10-29',
            publishedAt: '2026-10-29T12:00:00',
            rowVersion: terms.rowVersion + 1,
          };
      } else if (path.pathname.endsWith('/publication') && req.method === 'DELETE') {
        if (Number(path.searchParams.get('rowVersion')) !== terms.rowVersion) error = 'PLATFORM-409-1';
        else terms = { ...terms, status: 'CANCELLED', rowVersion: terms.rowVersion + 1 };
      }
      res.writeHead(error ? 409 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(error ? { code: error } : { data: terms }));
      return;
    }
    let code: string | undefined;
    if (
      path.pathname !== '/api/v0/platform-admin/notices/1/publication' &&
      path.pathname !== '/api/v0/platform-admin/notices/1'
    ) {
      res.writeHead(404).end();
      return;
    }
    if (req.method === 'PUT') {
      writes++;
      if (body?.rowVersion !== notice.rowVersion) code = 'PLATFORM-409-1';
      else {
        notice = {
          ...notice,
          status: 'PUBLISHED',
          publishedAt: notice.publishedAt ?? '2026-10-29T12:00:00',
          rowVersion: notice.rowVersion + 1,
        };
      }
    } else if (req.method === 'DELETE') {
      writes++;
      if (Number(path.searchParams.get('rowVersion')) !== notice.rowVersion) code = 'PLATFORM-409-1';
      else {
        notice = { ...notice, status: 'HIDDEN', rowVersion: notice.rowVersion + 1 };
      }
    }
    res.writeHead(code ? 409 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(code ? { code } : { data: notice }));
  });
  await new Promise<void>((resolve, reject) => {
    java.once('error', reject);
    java.listen(0, '127.0.0.1', resolve);
  });
  const javaUrl = `http://127.0.0.1:${(java.address() as { port: number }).port}`;
  class TestModule {}
  Module({
    controllers: [NoticesController, TermsController, TermVersionsController],
    providers: [
      NoticeJavaClient,
      NoticesService,
      TermsJavaClient,
      TermsService,
      JavaApiClient,
      { provide: JAVA_API_CONFIG, useValue: { baseUrl: javaUrl, apiKey: 'test-key' } },
      { provide: DatabaseService, useValue: database },
      { provide: AccessLogService, useValue: { record: vi.fn() } },
      { provide: APP_GUARD, useClass: RoleGuard },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false });
  app.use((req: { headers: Record<string, string>; member?: unknown }, _res: unknown, next: () => void) => {
    req.member = {
      id: 8,
      email: 'admin@example.com',
      displayName: '관리자',
      jobRole: 'BE',
      role: req.headers['x-role'],
    };
    next();
  });
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
});

describe('terms API with fake Java and real HTTP', () => {
  test('saves drafts without an effective date, clears it, and rejects publishing without one', async () => {
    const created = await request('POST', '/terms/SERVICE_TERMS/versions', { content: notice.body });
    expect(created.status).toBe(201);
    const cleared = await request('PATCH', '/term-versions/9', { version: 1, effectiveDate: null });
    expect(cleared.status).toBe(200);
    await expectMatchesSpec(contract, cleared, { method: 'patch', path: '/term-versions/{id}' });
    const invalid = await request('PATCH', '/term-versions/9', { version: 1, effectiveDate: '2026-13-40' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT' });
    const saved = terms;
    terms = { ...terms, effectiveDate: null as unknown as string };
    const publish = await request('PUT', '/term-versions/9/publication', { version: terms.rowVersion });
    terms = saved;
    expect(publish.status).toBe(400);
    await expectMatchesSpec(contract, publish, { method: 'put', path: '/term-versions/{id}/publication' });
    expect(await publish.json()).toMatchObject({ code: 'TERMS_EFFECTIVE_DATE_REQUIRED' });
  });
  test('maps Java date errors and records publication and withdrawal', async () => {
    terms = { ...terms, effectiveDate: '2000-01-01' };
    const past = await request('PUT', '/term-versions/9/publication', { version: 1 });
    expect(past.status).toBe(400);
    await expectMatchesSpec(contract, past, { method: 'put', path: '/term-versions/{id}/publication' });
    expect(await past.json()).toMatchObject({ code: 'TERMS_EFFECTIVE_DATE_IN_PAST' });
    terms = { ...terms, effectiveDate: '2099-11-20' };
    const published = await request('PUT', '/term-versions/9/publication', { version: 1 });
    expect(published.status).toBe(200);
    await expectMatchesSpec(contract, published, { method: 'put', path: '/term-versions/{id}/publication' });
    expect(await published.json()).toMatchObject({ kind: 'SERVICE_TERMS', effectiveStatus: 'SCHEDULED' });
    const missing = await request('DELETE', '/term-versions/9/publication');
    expect(missing.status).toBe(400);
    const staleWithdraw = await request('DELETE', '/term-versions/9/publication?version=1');
    expect(staleWithdraw.status).toBe(409);
    await expectMatchesSpec(contract, staleWithdraw, { method: 'delete', path: '/term-versions/{id}/publication' });
    expect(await staleWithdraw.json()).toMatchObject({ code: 'TERMS_VERSION_CONFLICT' });
    const withdrawn = await request('DELETE', '/term-versions/9/publication?version=2');
    expect(withdrawn.status).toBe(200);
    await expectMatchesSpec(contract, withdrawn, { method: 'delete', path: '/term-versions/{id}/publication' });
    expect(await withdrawn.json()).toMatchObject({ publishStatus: 'WITHDRAWN', effectiveStatus: null });
    expect(changes.slice(-3).map((change) => change.action)).toEqual([
      'TERMS_VERSION_CREATED',
      'TERMS_VERSION_PUBLISHED',
      'TERMS_VERSION_WITHDRAWN',
    ]);
    expect(changes.slice(-3).map((change) => change.targetLabel)).toEqual(
      Array(3).fill('서비스 이용약관 (시행 2099-11-20)')
    );
  });
});
afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) => java.close((err) => (err ? reject(err) : resolve())));
});
const request = (method: string, path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'x-role': 'SUPER_ADMIN', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('notice API with fake Java and real HTTP', () => {
  test('publishes, rejects a stale version, unpublishes, and republishes', async () => {
    const publish = await request('PUT', '/notices/1/publication', { version: 1 });
    expect(publish.status).toBe(200);
    await expectMatchesSpec(contract, publish, { method: 'put', path: '/notices/{id}/publication' });
    expect(await publish.json()).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: '2026-10-29T03:00:00.000Z',
      version: 2,
    });
    const stale = await request('PUT', '/notices/1/publication', { version: 1 });
    expect(stale.status).toBe(409);
    await expectMatchesSpec(contract, stale, { method: 'put', path: '/notices/{id}/publication' });
    const unpublishWithoutVersion = await request('DELETE', '/notices/1/publication');
    expect(unpublishWithoutVersion.status).toBe(400);
    const staleUnpublish = await request('DELETE', '/notices/1/publication?version=1');
    expect(staleUnpublish.status).toBe(409);
    await expectMatchesSpec(contract, staleUnpublish, { method: 'delete', path: '/notices/{id}/publication' });
    expect(await staleUnpublish.json()).toMatchObject({ code: 'NOTICE_VERSION_CONFLICT' });
    const unpublish = await request('DELETE', '/notices/1/publication?version=2');
    expect(unpublish.status).toBe(200);
    await expectMatchesSpec(contract, unpublish, { method: 'delete', path: '/notices/{id}/publication' });
    expect(await unpublish.json()).toMatchObject({ status: 'UNPUBLISHED', version: 3 });
    const republish = await request('PUT', '/notices/1/publication', { version: 3 });
    expect(republish.status).toBe(200);
    expect(changes.filter((change) => change.targetType === 'NOTICE').map((change) => change.action)).toEqual([
      'NOTICE_CREATED',
      'NOTICE_UNPUBLISHED',
      'NOTICE_REPUBLISHED',
    ]);
  });
  test('does not repeat a successful write when the change log fails', async () => {
    failLog = true;
    const before = writes;
    const response = await request('DELETE', `/notices/1/publication?version=${notice.rowVersion}`);
    expect(response.status).toBe(200);
    expect(writes).toBe(before + 1);
    failLog = false;
  });
  test('rejects deleting a notice without or with a stale version', async () => {
    const missing = await request('DELETE', '/notices/1');
    expect(missing.status).toBe(400);
    const stale = await request('DELETE', '/notices/1?version=0');
    expect(stale.status).toBe(409);
    await expectMatchesSpec(contract, stale, { method: 'delete', path: '/notices/{id}' });
    expect(await stale.json()).toMatchObject({ code: 'NOTICE_VERSION_CONFLICT' });
  });
  test('reads Java date and time arrays as KST', async () => {
    const asArray = (value: unknown) => value as string;
    notice = {
      ...notice,
      status: 'DRAFT',
      publishedAt: asArray([2026, 10, 17, 1, 29, 48, 365885000]),
      createdAt: asArray([2026, 10, 17, 0, 0, 0, 0]),
      updatedAt: asArray([2026, 10, 18, 0, 0, 0]),
    };
    const response = await request('PUT', '/notices/1/publication', { version: notice.rowVersion });
    expect(response.status).toBe(200);
    await expectMatchesSpec(contract, response, { method: 'put', path: '/notices/{id}/publication' });
    expect(await response.json()).toMatchObject({
      publishedAt: '2026-10-16T16:29:48.365Z',
      createdAt: '2026-10-16T15:00:00.000Z',
      updatedAt: '2026-10-17T15:00:00.000Z',
    });
  });
});
