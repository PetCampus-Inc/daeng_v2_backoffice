import { Inject, Injectable, Logger } from '@nestjs/common';
import { recordChangeBestEffort } from '../change-log/record-best-effort.js';
import type { ChangeLogInput } from '../change-log/record.js';
import { kstToIso } from '../common/time.js';
import { DatabaseService } from '../database/database.service.js';
import type { MemberRow } from '../database/schema.js';
import { requireMarkdownBody } from '../java-api/java-content.js';
import { NoticeJavaClient, type JavaNotice } from './notice-java.client.js';

const dateTime = (value: string | null) => (value === null ? null : kstToIso(value));

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);
  constructor(
    @Inject(NoticeJavaClient) private readonly java: NoticeJavaClient,
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {}

  async list(query: { page: number; size: number; keyword?: string; status?: string }) {
    const page = await this.java.list(query);
    return {
      items: page.items.map((item) => this.summary(item)),
      page: page.page + 1,
      size: page.size,
      totalItems: page.totalElements,
      totalPages: page.totalPages,
    };
  }

  async get(id: number) {
    return this.detail(await this.java.get(id));
  }

  async create(body: unknown) {
    return this.detail(await this.java.create(body));
  }

  async update(
    actor: MemberRow,
    id: number,
    body: { version: number; title?: string; body?: string; pendingImages?: unknown[] }
  ) {
    // 게시된 적 있는 공지만 변경 이력 대상이라 쓰기 전에 현재 상태를 읽는다. 사이에 끼어든 변경은 버전 충돌로 막힌다.
    const before = await this.java.get(id);
    this.detail(before);
    const { version, ...data } = body;
    const result = await this.java.update(id, data, version);
    if (before.publishedAt !== null) await this.record(actor, id, result, 'NOTICE_EDITED');
    return this.detail(result);
  }

  async publish(actor: MemberRow, id: number, version: number) {
    const before = await this.java.get(id);
    this.detail(before);
    const result = await this.java.publish(id, version);
    await this.record(actor, id, result, before.publishedAt === null ? 'NOTICE_CREATED' : 'NOTICE_REPUBLISHED');
    return this.detail(result);
  }

  async unpublish(actor: MemberRow, id: number) {
    const before = await this.java.get(id);
    this.detail(before);
    const result = await this.java.unpublish(id, before.rowVersion);
    await this.record(actor, id, result, 'NOTICE_UNPUBLISHED');
    return this.detail(result);
  }

  async delete(id: number) {
    const before = await this.java.get(id);
    await this.java.delete(id, before.rowVersion);
  }

  uploadImages(body: Parameters<NoticeJavaClient['uploadUrls']>[0]) {
    return this.java.uploadUrls(body);
  }

  private summary(item: JavaNotice) {
    return {
      id: item.id,
      title: item.title,
      status: item.status === 'HIDDEN' ? 'UNPUBLISHED' : item.status,
      publishedAt: dateTime(item.publishedAt),
      createdAt: dateTime(item.createdAt),
      updatedAt: dateTime(item.updatedAt),
    };
  }

  private detail(item: JavaNotice) {
    return {
      ...this.summary(item),
      body: requireMarkdownBody('Notice', item.id, item.body),
      version: item.rowVersion,
      images: item.images ?? [],
    };
  }

  private record(
    actor: MemberRow,
    id: number,
    item: JavaNotice,
    action: Extract<ChangeLogInput, { target: { type: 'NOTICE' } }>['action']
  ) {
    return recordChangeBestEffort(this.database, this.logger, {
      actor,
      target: { type: 'NOTICE', id, label: item.title },
      action,
    });
  }
}
