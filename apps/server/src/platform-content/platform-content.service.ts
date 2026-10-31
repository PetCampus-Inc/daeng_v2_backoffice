import { Inject, Injectable, Logger } from '@nestjs/common';
import { recordChange, type ChangeLogInput } from '../change-log/record.js';
import { ApiException, ValidationFailedException } from '../common/api-error.js';
import { retry } from '../common/retry.js';
import { DatabaseService } from '../database/database.service.js';
import { isTransientDatabaseError } from '../database/errors.js';
import type { MemberRow } from '../database/schema.js';
import { kstToIso } from '../inquiries/inquiry-reader.js';
import { JavaApiClient } from '../java-api/java-api.client.js';

type Kind = 'SERVICE_TERMS' | 'PRIVACY_POLICY' | 'LOCATION_TERMS';
type JavaKind = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'LOCATION_SERVICE_TERMS';
/** Java는 날짜·시각을 `[2026,10,17]`·`[2026,10,17,1,29,48,365885000]` 배열로 내려준다. 문자열이 오면 그대로 쓴다. */
type JavaTemporal = string | number[];
type Item = {
  id: number;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  body: unknown;
  type: JavaKind;
  effectiveDate: string | null;
  announcedDate: string | null;
  images?: { imageId: number; previewUrl: string | null }[];
};
type RawItem = Omit<Item, 'publishedAt' | 'createdAt' | 'updatedAt' | 'effectiveDate' | 'announcedDate'> & {
  publishedAt: JavaTemporal | null;
  createdAt: JavaTemporal;
  updatedAt: JavaTemporal;
  effectiveDate?: JavaTemporal | null;
  announcedDate?: JavaTemporal | null;
};
type Page = { items: Item[]; page: number; size: number; totalElements: number; totalPages: number };
type RawPage = Omit<Page, 'items'> & { items: RawItem[] };
const KINDS: Record<Kind, JavaKind> = {
  SERVICE_TERMS: 'TERMS_OF_SERVICE',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  LOCATION_TERMS: 'LOCATION_SERVICE_TERMS',
};
const REVERSE_KINDS: Record<JavaKind, Kind> = {
  TERMS_OF_SERVICE: 'SERVICE_TERMS',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  LOCATION_SERVICE_TERMS: 'LOCATION_TERMS',
};
const NOTICE = '/api/v0/platform-admin/notices';
const TERMS = '/api/v0/platform-admin/legal-documents';
const pad = (value: number | undefined, width = 2) => String(value ?? 0).padStart(width, '0');
/** `YYYY-MM-DD`. */
const javaDate = (value: JavaTemporal | null | undefined) =>
  value == null ? null : Array.isArray(value) ? `${value[0]}-${pad(value[1])}-${pad(value[2])}` : value;
/** `kstToIso`가 읽는 `YYYY-MM-DD HH:mm:ss.nnnnnnnnn`. 배열에서 0인 초·나노초는 빠져 있을 수 있다. */
const javaDateTime = (value: JavaTemporal | null | undefined) =>
  value == null
    ? null
    : Array.isArray(value)
      ? `${javaDate(value)} ${pad(value[3])}:${pad(value[4])}:${pad(value[5])}.${pad(value[6], 9)}`
      : value;
const normalize = (raw: RawItem): Item => ({
  ...raw,
  publishedAt: javaDateTime(raw.publishedAt),
  createdAt: javaDateTime(raw.createdAt)!,
  updatedAt: javaDateTime(raw.updatedAt)!,
  effectiveDate: javaDate(raw.effectiveDate),
  announcedDate: javaDate(raw.announcedDate),
});
const dateTime = (value: string | null) => (value === null ? null : kstToIso(value));
const error = (status: number, code: string) => () => new ApiException(status, code, '요청을 처리할 수 없습니다.');
const invalidBody = () =>
  new ValidationFailedException([{ field: 'body', reason: '본문 또는 이미지 참조가 올바르지 않습니다.' }]);
const NOTICE_ERRORS = {
  'PLATFORM-400-1': invalidBody,
  'PLATFORM-400-2': invalidBody,
  'PLATFORM_NOTICE-404-1': error(404, 'NOTICE_NOT_FOUND'),
  'PLATFORM-409-1': error(409, 'NOTICE_VERSION_CONFLICT'),
  'PLATFORM-409-2': error(409, 'NOTICE_VERSION_CONFLICT'),
  'PLATFORM-409-3': error(409, 'NOTICE_ALREADY_PUBLISHED'),
  'PLATFORM-409-4': error(409, 'NOTICE_NOT_PUBLISHED'),
  'PLATFORM-409-13': error(409, 'NOTICE_NOT_DRAFT'),
  'PLATFORM-400-3': error(400, 'NOTICE_CONTENT_REQUIRED'),
};
const TERMS_ERRORS = {
  'PLATFORM-400-1': invalidBody,
  'PLATFORM_LEGAL_DOCUMENT-404-1': error(404, 'TERMS_VERSION_NOT_FOUND'),
  'PLATFORM-409-1': error(409, 'TERMS_VERSION_CONFLICT'),
  'PLATFORM-409-2': error(409, 'TERMS_VERSION_CONFLICT'),
  'PLATFORM-409-5': error(409, 'TERMS_VERSION_NOT_DRAFT'),
  'PLATFORM-409-6': error(409, 'TERMS_VERSION_NOT_DRAFT'),
  'PLATFORM-409-9': error(409, 'TERMS_WITHDRAW_NOT_ALLOWED'),
  'PLATFORM-409-11': error(400, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST'),
  'PLATFORM-409-14': error(400, 'TERMS_EFFECTIVE_DATE_IN_PAST'),
  'PLATFORM-409-15': error(400, 'TERMS_EFFECTIVE_DATE_TOO_SOON'),
  'PLATFORM-409-16': error(400, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST'),
};

@Injectable()
export class PlatformContentService {
  private readonly logger = new Logger(PlatformContentService.name);
  constructor(
    @Inject(JavaApiClient) private readonly java: JavaApiClient,
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {}
  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    errors: Record<string, () => ApiException> = {}
  ): Promise<T> {
    const result = (await this.java.requestJava(method, path, body, errors)) as { data?: T } | undefined;
    return result?.data as T;
  }
  private async callItem(
    method: string,
    path: string,
    body?: unknown,
    errors: Record<string, () => ApiException> = {}
  ): Promise<Item> {
    return normalize(await this.call<RawItem>(method, path, body, errors));
  }
  private async callPage(
    method: string,
    path: string,
    body?: unknown,
    errors: Record<string, () => ApiException> = {}
  ): Promise<Page> {
    const page = await this.call<RawPage>(method, path, body, errors);
    return { ...page, items: page.items.map(normalize) };
  }
  private noticeSummary(item: Item) {
    return {
      id: item.id,
      title: item.title,
      status: item.status === 'HIDDEN' ? 'UNPUBLISHED' : item.status,
      publishedAt: dateTime(item.publishedAt),
      createdAt: dateTime(item.createdAt),
      updatedAt: dateTime(item.updatedAt),
    };
  }
  private notice(item: Item) {
    if (typeof item.body !== 'string') throw new Error(`Notice ${item.id} has legacy JSON body; migration required`);
    return { ...this.noticeSummary(item), body: item.body, version: item.rowVersion, images: item.images ?? [] };
  }
  async listNotices(query: { page: number; size: number; keyword?: string; status?: string }) {
    const params = new URLSearchParams({ page: String(query.page - 1), size: String(query.size) });
    if (query.keyword) params.set('query', query.keyword);
    if (query.status) params.set('status', query.status === 'UNPUBLISHED' ? 'HIDDEN' : query.status);
    const page = await this.callPage('GET', `${NOTICE}?${params}`, undefined, NOTICE_ERRORS);
    return {
      items: page.items.map((item) => this.noticeSummary(item)),
      page: page.page + 1,
      size: page.size,
      totalItems: page.totalElements,
      totalPages: page.totalPages,
    };
  }
  async getNotice(id: number) {
    return this.notice(await this.noticeRaw(id));
  }
  private noticeRaw(id: number) {
    return this.callItem('GET', `${NOTICE}/${id}`, undefined, NOTICE_ERRORS);
  }
  async createNotice(body: unknown) {
    return this.notice(await this.callItem('POST', NOTICE, body, NOTICE_ERRORS));
  }
  async updateNotice(
    actor: MemberRow,
    id: number,
    body: { version: number; title?: string; body?: string; pendingImages?: unknown[] }
  ) {
    const before = await this.noticeRaw(id);
    this.notice(before);
    const { version, ...data } = body;
    const result = await this.callItem('PATCH', `${NOTICE}/${id}`, { ...data, rowVersion: version }, NOTICE_ERRORS);
    if (before.publishedAt !== null)
      await this.record({ actor, target: { type: 'NOTICE', id, label: result.title }, action: 'NOTICE_EDITED' });
    return this.notice(result);
  }
  async publishNotice(actor: MemberRow, id: number, version: number) {
    const before = await this.noticeRaw(id);
    this.notice(before);
    const result = await this.callItem('PUT', `${NOTICE}/${id}/publication`, { rowVersion: version }, NOTICE_ERRORS);
    await this.record({
      actor,
      target: { type: 'NOTICE', id, label: result.title },
      action: before.publishedAt === null ? 'NOTICE_CREATED' : 'NOTICE_REPUBLISHED',
    });
    return this.notice(result);
  }
  async unpublishNotice(actor: MemberRow, id: number) {
    const before = await this.noticeRaw(id);
    this.notice(before);
    const result = await this.callItem(
      'DELETE',
      `${NOTICE}/${id}/publication?rowVersion=${before.rowVersion}`,
      undefined,
      NOTICE_ERRORS
    );
    await this.record({ actor, target: { type: 'NOTICE', id, label: result.title }, action: 'NOTICE_UNPUBLISHED' });
    return this.notice(result);
  }
  async deleteNotice(id: number) {
    const before = await this.noticeRaw(id);
    await this.call('DELETE', `${NOTICE}/${id}?rowVersion=${before.rowVersion}`, undefined, NOTICE_ERRORS);
  }
  uploadImages(body: { noticeId?: number; files: { fileName: string; contentType: string; size: number }[] }) {
    return this.call(
      'POST',
      `${NOTICE}/images/upload-urls`,
      { ...body, files: body.files.map(({ fileName, ...file }) => ({ filename: fileName, ...file })) },
      { ...NOTICE_ERRORS, 'PLATFORM-400-2': error(400, 'NOTICE_IMAGE_INVALID') }
    );
  }
  private async allTerms(kind: Kind): Promise<Item[]> {
    const items: Item[] = [];
    let page = 0;
    let totalPages: number;
    do {
      const result = await this.callPage(
        'GET',
        `${TERMS}/types/${KINDS[kind]}/versions?page=${page}&size=100`,
        undefined,
        TERMS_ERRORS
      );
      items.push(...result.items);
      totalPages = result.totalPages;
      page++;
    } while (page < totalPages);
    return items;
  }
  private summary(item: Item, all: Item[]) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const current = all
      .filter((v) => v.status === 'PUBLISHED' && v.effectiveDate && v.effectiveDate <= today)
      .sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || b.id - a.id)[0];
    const effectiveStatus =
      item.status !== 'PUBLISHED'
        ? null
        : item.effectiveDate && item.effectiveDate > today
          ? 'SCHEDULED'
          : item.id === current?.id
            ? 'CURRENT'
            : 'PAST';
    return {
      id: item.id,
      kind: REVERSE_KINDS[item.type],
      effectiveDate: item.effectiveDate,
      publishStatus: item.status === 'CANCELLED' ? 'WITHDRAWN' : item.status,
      effectiveStatus,
      publishedAt: dateTime(item.publishedAt),
      updatedAt: dateTime(item.updatedAt),
    };
  }
  async listTermsVersions(kind: Kind) {
    const all = await this.allTerms(kind);
    return all
      .map((v) => this.summary(v, all))
      .sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || b.id - a.id);
  }
  async listTerms() {
    return Promise.all(
      (Object.keys(KINDS) as Kind[]).map(async (kind) => {
        const versions = await this.listTermsVersions(kind);
        return {
          kind,
          currentVersion: versions.find((v) => v.effectiveStatus === 'CURRENT') ?? null,
          scheduledVersion: versions.filter((v) => v.effectiveStatus === 'SCHEDULED').at(-1) ?? null,
        };
      })
    );
  }
  async draftTemplate(kind: Kind) {
    const result = await this.call<{ content: string }>(
      'GET',
      `${TERMS}/types/${KINDS[kind]}/draft-template`,
      undefined,
      TERMS_ERRORS
    );
    return { content: result.content || null };
  }
  private async termsDetail(item: Item, knownItems?: Item[]) {
    if (typeof item.body !== 'string') throw new Error(`Terms ${item.id} has legacy JSON body; migration required`);
    const all = knownItems ?? (await this.allTerms(REVERSE_KINDS[item.type]));
    return {
      ...this.summary(item, all),
      content: item.body,
      announcedDate: item.announcedDate,
      version: item.rowVersion,
    };
  }
  private termsRaw(id: number) {
    return this.callItem('GET', `${TERMS}/${id}`, undefined, TERMS_ERRORS);
  }
  async getTerms(id: number) {
    return this.termsDetail(await this.termsRaw(id));
  }
  async createTerms(kind: Kind, body: { effectiveDate: string; content: string }) {
    const item = await this.callItem(
      'POST',
      `${TERMS}/types/${KINDS[kind]}/versions`,
      { body: body.content, effectiveDate: body.effectiveDate },
      TERMS_ERRORS
    );
    return this.termsDetail(item, [item]);
  }
  async updateTerms(id: number, body: { version: number; content?: string; effectiveDate?: string }) {
    const { version, content, ...rest } = body;
    if (content === undefined && typeof (await this.termsRaw(id)).body !== 'string')
      throw new Error(`Terms ${id} has legacy JSON body; migration required`);
    return this.termsDetail(
      await this.callItem(
        'PATCH',
        `${TERMS}/${id}`,
        { ...rest, ...(content === undefined ? {} : { body: content }), rowVersion: version },
        TERMS_ERRORS
      ),
      []
    );
  }
  async publishTerms(actor: MemberRow, id: number, version: number) {
    if (typeof (await this.termsRaw(id)).body !== 'string')
      throw new Error(`Terms ${id} has legacy JSON body; migration required`);
    const item = await this.callItem('PUT', `${TERMS}/${id}/publication`, { rowVersion: version }, TERMS_ERRORS);
    await this.record({
      actor,
      target: { type: 'TERMS_VERSION', id, label: item.title },
      action: 'TERMS_VERSION_CREATED',
    });
    await this.record({
      actor,
      target: { type: 'TERMS_VERSION', id, label: item.title },
      action: 'TERMS_VERSION_PUBLISHED',
    });
    return this.termsDetail(item, [item]);
  }
  async withdrawTerms(actor: MemberRow, id: number) {
    const before = await this.termsRaw(id);
    if (typeof before.body !== 'string') throw new Error(`Terms ${id} has legacy JSON body; migration required`);
    const item = await this.callItem(
      'DELETE',
      `${TERMS}/${id}/publication?rowVersion=${before.rowVersion}`,
      undefined,
      TERMS_ERRORS
    );
    await this.record({
      actor,
      target: { type: 'TERMS_VERSION', id, label: item.title },
      action: 'TERMS_VERSION_WITHDRAWN',
    });
    return this.termsDetail(item, [item]);
  }
  async deleteTerms(id: number) {
    const before = await this.termsRaw(id);
    await this.call('DELETE', `${TERMS}/${id}?rowVersion=${before.rowVersion}`, undefined, TERMS_ERRORS);
  }
  private async record(input: ChangeLogInput) {
    try {
      await retry(() => this.database.db.transaction((tx) => recordChange(tx, input)), {
        delaysMs: [100, 300],
        shouldRetry: isTransientDatabaseError,
      });
    } catch (cause) {
      this.logger.error(
        `변경 이력 수동 보완 필요: ${JSON.stringify({ actorMemberId: input.actor.id, target: input.target, action: input.action })}`,
        cause instanceof Error ? cause.stack : String(cause)
      );
    }
  }
}
