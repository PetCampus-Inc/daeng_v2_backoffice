import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { NoticeJavaClient } from '../../src/notices/notice-java.client.js';
import { NoticesService } from '../../src/notices/notices.service.js';
import { TermsJavaClient } from '../../src/terms/terms-java.client.js';
import { TermsService } from '../../src/terms/terms.service.js';
import type { JavaApiClient } from '../../src/java-api/java-api.client.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import type { MemberRow } from '../../src/database/schema.js';

const actor = { id: 1, email: 'admin@example.com', displayName: '관리자', jobRole: 'BE' } as MemberRow;
const notice = {
  id: 7,
  title: '공지',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: '2026-10-20T12:00:00',
  updatedAt: '2026-10-20T12:00:00',
  rowVersion: 2,
  body: { schemaVersion: 1, blocks: [{ type: 'p', children: [{ text: '본문' }] }] },
  previewBody: { schemaVersion: 1, blocks: [{ type: 'p', children: [{ text: '본문' }] }] },
};
const terms = { ...notice, type: 'TERMS_OF_SERVICE', effectiveDate: '2026-11-20', announcedDate: null };
function setup(responses: unknown[]) {
  const requestJava = vi.fn(async () => ({ data: responses.shift() }));
  const values = vi.fn(async () => undefined);
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({ insert: () => ({ values }) }));
  const java = { requestJava } as unknown as JavaApiClient;
  const database = { db: { transaction } } as unknown as DatabaseService;
  const notices = new NoticesService(new NoticeJavaClient(java), database);
  const terms = new TermsService(new TermsJavaClient(java), database);
  return { notices, terms, requestJava, values, transaction };
}

describe('platform content Java translation', () => {
  test('translates notice filters, pagination, statuses, and KST timestamps', async () => {
    const { notices, requestJava } = setup([
      { items: [{ ...notice, status: 'HIDDEN' }], page: 1, size: 20, totalElements: 21, totalPages: 2 },
    ]);
    const result = await notices.list({ page: 2, size: 20, status: 'UNPUBLISHED', keyword: '점검' });
    expect(requestJava.mock.calls[0]![1]).toContain('page=1&size=20');
    expect(requestJava.mock.calls[0]![1]).toContain('status=HIDDEN');
    expect(result).toMatchObject({
      page: 2,
      totalItems: 21,
      items: [{ status: 'UNPUBLISHED', createdAt: '2026-10-20T03:00:00.000Z', version: 2 }],
    });
  });
  test('reads Java date and time arrays as KST', async () => {
    const item = {
      ...terms,
      status: 'PUBLISHED',
      publishedAt: [2026, 10, 17, 1, 29, 48, 365885000],
      createdAt: [2026, 10, 17, 1, 41],
      updatedAt: [2026, 10, 18, 0, 0, 0],
      effectiveDate: [2026, 11, 5],
      announcedDate: [2026, 10, 17],
    };
    const { terms: service } = setup([item, { items: [item], page: 0, size: 100, totalElements: 1, totalPages: 1 }]);
    const result = await service.get(7);
    expect(result).toMatchObject({
      effectiveDate: '2026-11-05',
      announcedDate: '2026-10-17',
      publishedAt: '2026-10-16T16:29:48.365Z',
      updatedAt: '2026-10-17T15:00:00.000Z',
    });
  });
  test('uses the supplied version and distinguishes first publication from republication', async () => {
    const { notices, requestJava, values } = setup([
      notice,
      { ...notice, status: 'PUBLISHED', publishedAt: '2026-10-29T12:00:00' },
    ]);
    await notices.publish(actor, 7, 2);
    expect(requestJava.mock.calls[1]![2]).toEqual({ rowVersion: 2 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ action: 'NOTICE_CREATED', targetId: 7 }));
  });
  test('fetches all terms pages and determines current and scheduled versions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    try {
      const current = { ...terms, id: 1, status: 'PUBLISHED', effectiveDate: '2026-10-01' };
      const scheduled = { ...terms, id: 2, status: 'PUBLISHED', effectiveDate: '2026-11-20' };
      const { terms: service, requestJava } = setup([
        { items: [current], totalPages: 2 },
        { items: [scheduled], totalPages: 2 },
      ]);
      expect(await service.listVersions('SERVICE_TERMS')).toMatchObject([
        { id: 2, effectiveStatus: 'SCHEDULED' },
        { id: 1, effectiveStatus: 'CURRENT' },
      ]);
      expect(requestJava).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  test('sends no effective date when creating a draft without one and forwards null to clear it', async () => {
    const draft = { ...terms, status: 'DRAFT', effectiveDate: null };
    const { terms: service, requestJava } = setup([draft, draft]);
    await service.create('SERVICE_TERMS', { content: notice.body });
    expect(requestJava.mock.calls[0]![2]).toEqual({ body: notice.body });
    await service.update(7, { version: 2, content: notice.body, effectiveDate: null });
    expect(requestJava.mock.calls[1]![2]).toEqual({ effectiveDate: null, body: notice.body, rowVersion: 2 });
  });
  test('lists drafts first by newest id, then versions by effective date descending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    try {
      const items = [
        { ...terms, id: 1, status: 'PUBLISHED', effectiveDate: '2026-10-01' },
        { ...terms, id: 2, status: 'PUBLISHED', effectiveDate: '2026-11-20' },
        { ...terms, id: 3, status: 'DRAFT', effectiveDate: '2026-09-01' },
        { ...terms, id: 4, status: 'DRAFT', effectiveDate: null },
      ];
      const { terms: service } = setup([{ items, totalPages: 1 }]);
      const result = await service.listVersions('SERVICE_TERMS');
      expect(result.map((v) => v.id)).toEqual([4, 3, 2, 1]);
    } finally {
      vi.useRealTimers();
    }
  });
  test('converts file names to Java image upload contract', async () => {
    const { notices, requestJava } = setup([[]]);
    await notices.uploadImages({ files: [{ fileName: 'a.png', contentType: 'image/png', size: 10 }] });
    expect(requestJava.mock.calls[0]![2]).toEqual({
      files: [{ filename: 'a.png', contentType: 'image/png', size: 10 }],
    });
  });
  test('returns the notice body and preview body as block JSON without images', async () => {
    const { notices } = setup([notice]);
    const result = await notices.get(7);
    expect(result).toMatchObject({ body: notice.body, previewBody: notice.previewBody, version: 2 });
    expect(result).not.toHaveProperty('images');
  });
  test('sends the update body to Java as an object without pending images', async () => {
    const { notices, requestJava } = setup([notice, notice]);
    await notices.update(actor, 7, { version: 2, body: notice.body });
    expect(requestJava.mock.calls[1]![2]).toEqual({ body: notice.body, rowVersion: 2 });
  });
  test('returns a null draft template when there is no published terms version', async () => {
    const empty = { schemaVersion: 1, blocks: [] };
    const { terms: service } = setup([{ content: empty }, { content: notice.body }]);
    expect(await service.draftTemplate('SERVICE_TERMS')).toEqual({ content: null });
    expect(await service.draftTemplate('SERVICE_TERMS')).toEqual({ content: notice.body });
  });
  test('exposes the Java row version as the terms version on summaries', async () => {
    const { terms: service } = setup([
      { items: [{ ...terms, status: 'PUBLISHED' }], page: 0, size: 100, totalElements: 1, totalPages: 1 },
    ]);
    expect(await service.listVersions('SERVICE_TERMS')).toMatchObject([{ id: 7, version: 2 }]);
  });
});

test('keeps a successful publication when change log storage fails', async () => {
  const { notices, transaction, requestJava } = setup([
    notice,
    { ...notice, status: 'PUBLISHED', publishedAt: '2026-10-29T12:00:00' },
  ]);
  transaction.mockRejectedValue(new Error('database unavailable'));
  const logger = vi
    .spyOn((notices as unknown as { logger: { error: () => void } }).logger, 'error')
    .mockImplementation(() => undefined);
  expect(await notices.publish(actor, 7, 2)).toMatchObject({ status: 'PUBLISHED' });
  expect(requestJava).toHaveBeenCalledTimes(2);
  expect(logger).toHaveBeenCalled();
});

test('the real Java transport maps a publication conflict', async () => {
  const { JavaApiClient } = await import('../../src/java-api/java-api.client.js');
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: notice }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PLATFORM-409-1' }), { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);
  try {
    const service = new NoticesService(
      new NoticeJavaClient(new JavaApiClient({ baseUrl: 'http://java.test', apiKey: 'key' })),
      {} as DatabaseService
    );
    await expect(service.publish(actor, 7, 1)).rejects.toMatchObject({
      response: { code: 'NOTICE_VERSION_CONFLICT' },
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

test('publishing a terms draft records registration and publication without another Java read', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
  try {
    const {
      terms: service,
      requestJava,
      values,
    } = setup([{ ...terms, status: 'PUBLISHED', publishedAt: '2026-10-29T12:00:00' }]);
    expect(await service.publish(actor, 7, 2)).toMatchObject({ effectiveStatus: 'SCHEDULED' });
    expect(requestJava).toHaveBeenCalledTimes(1);
    expect(values.mock.calls.map((call) => call[0].action)).toEqual([
      'TERMS_VERSION_CREATED',
      'TERMS_VERSION_PUBLISHED',
    ]);
    // 같은 약관의 여러 버전을 이력에서 구별하도록 종류와 시행일을 남긴다.
    expect(values.mock.calls.map((call) => call[0].targetLabel)).toEqual([
      '서비스 이용약관 (시행 2026-11-20)',
      '서비스 이용약관 (시행 2026-11-20)',
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test.each([
  ['PLATFORM-409-7', 'TERMS_EFFECTIVE_DATE_REQUIRED'],
  ['PLATFORM-409-11', 'TERMS_EFFECTIVE_DATE_DUPLICATED'],
])('the real Java transport maps %s on terms publication to %s', async (javaCode, boCode) => {
  const { JavaApiClient } = await import('../../src/java-api/java-api.client.js');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: javaCode }), { status: 409 })));
  try {
    const service = new TermsService(
      new TermsJavaClient(new JavaApiClient({ baseUrl: 'http://java.test', apiKey: 'key' })),
      {} as DatabaseService
    );
    await expect(service.publish(actor, 7, 1)).rejects.toMatchObject({
      status: 400,
      response: { code: boCode },
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
