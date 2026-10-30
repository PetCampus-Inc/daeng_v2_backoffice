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
import { PlatformContentController } from '../../src/platform-content/platform-content.controller.js';
import { PlatformContentService } from '../../src/platform-content/platform-content.service.js';
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
  body: '약관 본문',
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
  body: '본문',
  status: 'DRAFT',
  publishedAt: null as string | null,
  createdAt: '2026-10-20T12:00:00',
  updatedAt: '2026-10-20T12:00:00',
  rowVersion: 1,
  images: [],
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
    controllers: [PlatformContentController],
    providers: [
      PlatformContentService,
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
    const withdrawn = await request('DELETE', '/term-versions/9/publication');
    expect(withdrawn.status).toBe(200);
    await expectMatchesSpec(contract, withdrawn, { method: 'delete', path: '/term-versions/{id}/publication' });
    expect(await withdrawn.json()).toMatchObject({ publishStatus: 'WITHDRAWN', effectiveStatus: null });
    expect(changes.slice(-3).map((change) => change.action)).toEqual([
      'TERMS_VERSION_CREATED',
      'TERMS_VERSION_PUBLISHED',
      'TERMS_VERSION_WITHDRAWN',
    ]);
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
    const unpublish = await request('DELETE', '/notices/1/publication');
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
    const response = await request('DELETE', '/notices/1/publication');
    expect(response.status).toBe(200);
    expect(writes).toBe(before + 1);
    failLog = false;
  });
});
