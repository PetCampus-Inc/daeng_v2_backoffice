import { Inject, Injectable, Logger } from '@nestjs/common';
import { recordChangeBestEffort } from '../change-log/record-best-effort.js';
import type { ChangeLogInput } from '../change-log/record.js';
import { kstToIso, todayInKst } from '../common/time.js';
import { DatabaseService } from '../database/database.service.js';
import type { MemberRow } from '../database/schema.js';
import type { ContentBody } from '../java-api/content-body.js';
import { currentVersionId, effectiveStatusOf } from './terms-status.js';
import { TermsJavaClient, type JavaTerms, type JavaTermsSummary } from './terms-java.client.js';
import { TERMS_KINDS, TERMS_KIND_NAMES, type TermsKind } from './terms.types.js';

const dateTime = (value: string | null) => (value === null ? null : kstToIso(value));
const draftFirstThenEffectiveDateDesc = (
  a: { publishStatus: string; effectiveDate: string | null; id: number },
  b: typeof a
) => {
  const aDraft = a.publishStatus === 'DRAFT';
  const bDraft = b.publishStatus === 'DRAFT';
  if (aDraft !== bDraft) return aDraft ? -1 : 1;
  if (aDraft) return b.id - a.id;
  return (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || b.id - a.id;
};

/** 변경 이력의 대상 이름. 종류와 시행일로 같은 약관의 버전을 구별한다. */
function historyLabel(item: JavaTermsSummary): string {
  const name = TERMS_KIND_NAMES[item.kind];
  return item.effectiveDate ? `${name} (시행 ${item.effectiveDate})` : name;
}

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
    return this.summaries(all).sort(draftFirstThenEffectiveDateDesc);
  }

  async draftTemplate(kind: TermsKind) {
    const content = await this.java.draftTemplate(kind);
    return { content: Array.isArray(content.blocks) && content.blocks.length === 0 ? null : content };
  }

  async get(id: number) {
    const item = await this.java.get(id);
    return this.detail(item, await this.java.allVersions(item.kind));
  }

  async create(kind: TermsKind, body: { effectiveDate?: string | null; content: ContentBody }) {
    const item = await this.java.create(kind, body);
    return this.detail(item, [item]);
  }

  async update(id: number, body: { version: number; content?: ContentBody; effectiveDate?: string | null }) {
    const { version, ...data } = body;
    return this.detail(await this.java.update(id, data, version), []);
  }

  async publish(actor: MemberRow, id: number, version: number) {
    const item = await this.java.publish(id, version);
    // 초안 저장은 이력 대상이 아니라 등록은 공개할 때 함께 남긴다.
    await this.record(actor, id, item, 'TERMS_VERSION_CREATED');
    await this.record(actor, id, item, 'TERMS_VERSION_PUBLISHED');
    return this.detail(item, [item]);
  }

  async withdraw(actor: MemberRow, id: number, version: number) {
    const item = await this.java.withdraw(id, version);
    await this.record(actor, id, item, 'TERMS_VERSION_WITHDRAWN');
    return this.detail(item, [item]);
  }

  async delete(id: number, version: number) {
    await this.java.delete(id, version);
  }

  private summaries(versions: readonly JavaTermsSummary[]) {
    const today = todayInKst();
    const currentId = currentVersionId(versions, today);
    return versions.map((v) => this.summary(v, today, currentId));
  }

  private summary(item: JavaTermsSummary, today: string, currentId: number | undefined) {
    return {
      id: item.id,
      kind: item.kind,
      effectiveDate: item.effectiveDate,
      publishStatus: item.status === 'CANCELLED' ? 'WITHDRAWN' : item.status,
      effectiveStatus: effectiveStatusOf(item, today, currentId),
      publishedAt: dateTime(item.publishedAt),
      updatedAt: dateTime(item.updatedAt),
      version: item.rowVersion,
    };
  }

  /** `versions`는 현행 판정용 같은 종류의 전체 버전. 방금 만들거나 공개·철회한 버전은 현행이 될 수 없어 그 버전만 넘겨도 된다. */
  private detail(item: JavaTerms, versions: readonly JavaTermsSummary[]) {
    const today = todayInKst();
    return {
      ...this.summary(item, today, currentVersionId(versions, today)),
      content: item.body,
      announcedDate: item.announcedDate,
    };
  }

  private record(
    actor: MemberRow,
    id: number,
    item: JavaTermsSummary,
    action: Extract<ChangeLogInput, { target: { type: 'TERMS_VERSION' } }>['action']
  ) {
    return recordChangeBestEffort(this.database, this.logger, {
      actor,
      target: { type: 'TERMS_VERSION', id, label: historyLabel(item) },
      action,
    });
  }
}
