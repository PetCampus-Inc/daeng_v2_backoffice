import { Inject, Injectable, Logger } from '@nestjs/common';
import { recordChangeBestEffort } from '../change-log/record-best-effort.js';
import type { ChangeLogInput } from '../change-log/record.js';
import { kstToIso, todayInKst } from '../common/time.js';
import { DatabaseService } from '../database/database.service.js';
import type { MemberRow } from '../database/schema.js';
import { requireMarkdownBody } from '../java-api/java-content.js';
import { currentVersionId, effectiveStatusOf } from './terms-status.js';
import { TermsJavaClient, type JavaTerms } from './terms-java.client.js';
import { TERMS_KINDS, type TermsKind } from './terms.types.js';

const dateTime = (value: string | null) => (value === null ? null : kstToIso(value));
const byEffectiveDateDesc = (a: { effectiveDate: string | null; id: number }, b: typeof a) =>
  (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || b.id - a.id;

@Injectable()
export class TermsService {
  private readonly logger = new Logger(TermsService.name);
  constructor(
    @Inject(TermsJavaClient) private readonly java: TermsJavaClient,
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {}

  async listKinds() {
    return Promise.all(
      TERMS_KINDS.map(async (kind) => {
        const versions = await this.listVersions(kind);
        return {
          kind,
          currentVersion: versions.find((v) => v.effectiveStatus === 'CURRENT') ?? null,
          scheduledVersion: versions.filter((v) => v.effectiveStatus === 'SCHEDULED').at(-1) ?? null,
        };
      })
    );
  }

  async listVersions(kind: TermsKind) {
    const all = await this.java.allVersions(kind);
    return this.summaries(all).sort(byEffectiveDateDesc);
  }

  async draftTemplate(kind: TermsKind) {
    return { content: (await this.java.draftTemplate(kind)) || null };
  }

  async get(id: number) {
    const item = await this.java.get(id);
    return this.detail(item, await this.java.allVersions(item.kind));
  }

  async create(kind: TermsKind, body: { effectiveDate: string; content: string }) {
    const item = await this.java.create(kind, body);
    return this.detail(item, [item]);
  }

  async update(id: number, body: { version: number; content?: string; effectiveDate?: string }) {
    const { version, ...data } = body;
    if (data.content === undefined) requireMarkdownBody('Terms', id, (await this.java.get(id)).body);
    return this.detail(await this.java.update(id, data, version), []);
  }

  async publish(actor: MemberRow, id: number, version: number) {
    requireMarkdownBody('Terms', id, (await this.java.get(id)).body);
    const item = await this.java.publish(id, version);
    // 초안 저장은 이력 대상이 아니라서 새 버전 등록은 공개하는 시점에 함께 남긴다.
    await this.record(actor, id, item, 'TERMS_VERSION_CREATED');
    await this.record(actor, id, item, 'TERMS_VERSION_PUBLISHED');
    return this.detail(item, [item]);
  }

  async withdraw(actor: MemberRow, id: number) {
    const before = await this.java.get(id);
    requireMarkdownBody('Terms', id, before.body);
    const item = await this.java.withdraw(id, before.rowVersion);
    await this.record(actor, id, item, 'TERMS_VERSION_WITHDRAWN');
    return this.detail(item, [item]);
  }

  async delete(id: number) {
    const before = await this.java.get(id);
    await this.java.delete(id, before.rowVersion);
  }

  private summaries(versions: readonly JavaTerms[]) {
    const today = todayInKst();
    const currentId = currentVersionId(versions, today);
    return versions.map((v) => this.summary(v, today, currentId));
  }

  private summary(item: JavaTerms, today: string, currentId: number | undefined) {
    return {
      id: item.id,
      kind: item.kind,
      effectiveDate: item.effectiveDate,
      publishStatus: item.status === 'CANCELLED' ? 'WITHDRAWN' : item.status,
      effectiveStatus: effectiveStatusOf(item, today, currentId),
      publishedAt: dateTime(item.publishedAt),
      updatedAt: dateTime(item.updatedAt),
    };
  }

  /**
   * `versions`는 현행 버전을 가리는 데 쓰는 같은 종류의 전체 버전이다. 방금 만들거나 공개·철회한 버전은 초안이거나 철회됐거나
   * 공개일로부터 7일 이후라서 현행이 될 수 없으므로 그 버전만 넘겨도 상태가 같다.
   */
  private detail(item: JavaTerms, versions: readonly JavaTerms[]) {
    const content = requireMarkdownBody('Terms', item.id, item.body);
    const today = todayInKst();
    return {
      ...this.summary(item, today, currentVersionId(versions, today)),
      content,
      announcedDate: item.announcedDate,
      version: item.rowVersion,
    };
  }

  private record(
    actor: MemberRow,
    id: number,
    item: JavaTerms,
    action: Extract<ChangeLogInput, { target: { type: 'TERMS_VERSION' } }>['action']
  ) {
    return recordChangeBestEffort(this.database, this.logger, {
      actor,
      target: { type: 'TERMS_VERSION', id, label: item.title },
      action,
    });
  }
}
