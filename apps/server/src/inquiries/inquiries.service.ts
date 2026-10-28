import { Inject, Injectable } from '@nestjs/common';
import { asc, inArray, isNotNull } from 'drizzle-orm';
import { recordChange } from '../change-log/record.js';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import { members, type MemberRow } from '../database/schema.js';
import { JavaApiClient } from '../java-api/java-api.client.js';
import { INQUIRY_IMAGE_BASE_URL } from './inquiries.config.js';
import { InquiryReader, type InquiryDetailRow, type InquiryFilter, type InquiryRow } from './inquiry-reader.js';

const notFound = () => new ApiException(404, 'INQUIRY_NOT_FOUND', '문의를 찾을 수 없습니다.');
/** 운영자 메시지의 작성자를 알 수 없을 때(작성자 ID가 없거나 계정이 사라졌을 때) 보여 줄 이름. */
const UNKNOWN_OPERATOR = '운영자';

export interface InquiryAssignee {
  id: number;
  email: string;
  displayName: string;
  jobRole: NonNullable<MemberRow['jobRole']>;
  isActive: boolean;
}

export interface InquirySummary {
  id: number;
  status: InquiryRow['status'];
  title: string;
  user: { type: InquiryRow['userType']; name: string; email: string };
  assignee: InquiryAssignee | null;
  lastActivityAt: string;
}

export interface InquiryDetail extends InquirySummary {
  createdAt: string;
  messages: Array<{
    id: string;
    author: 'USER' | 'OPERATOR';
    authorName: string;
    body: string;
    createdAt: string;
    images: Array<{ id: string; url: string; fileName: string }>;
  }>;
}

export interface InquiryPage {
  items: InquirySummary[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** 요청한 팀원이 보는 목록 조건. `ME`는 요청한 팀원으로 바뀐다. */
export interface InquiryQuery {
  keyword?: string;
  status?: InquiryFilter['status'];
  userType?: InquiryFilter['userType'];
  assignee?: 'ME' | 'UNASSIGNED' | number;
  sort: InquiryFilter['sort'];
}

@Injectable()
export class InquiriesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InquiryReader) private readonly reader: InquiryReader,
    @Inject(JavaApiClient) private readonly java: JavaApiClient,
    @Inject(INQUIRY_IMAGE_BASE_URL) private readonly imageBaseUrl: string
  ) {}

  async list(actor: MemberRow, query: InquiryQuery, page: number, size: number): Promise<InquiryPage> {
    const { rows, total } = await this.reader.list(this.filterOf(actor, query), page, size);
    const assignees = await this.assigneesOf(rows);
    return {
      items: rows.map((row) => toSummary(row, assignees)),
      page,
      size,
      totalItems: total,
      totalPages: Math.ceil(total / size),
    };
  }

  /** 표시명이 있는 팀원만 담당자 후보다. 비활성 팀원도 담당자로 남아 있을 수 있어 포함한다. */
  async listAssignees(): Promise<InquiryAssignee[]> {
    const rows = await this.database.db
      .select()
      .from(members)
      .where(isNotNull(members.displayName))
      .orderBy(asc(members.id));
    return rows.flatMap((row) => {
      const assignee = toAssignee(row);
      return assignee ? [assignee] : [];
    });
  }

  async detail(id: number): Promise<InquiryDetail> {
    const row = await this.reader.get(id);
    if (!row) throw notFound();
    return this.detailOf(row);
  }

  async adjacent(
    actor: MemberRow,
    id: number,
    query: InquiryQuery
  ): Promise<{ prevId: number | null; nextId: number | null }> {
    const result = await this.reader.adjacent(id, this.filterOf(actor, query));
    if (!result) throw notFound();
    return result;
  }

  // ---------- 쓰기
  // 상태 변경은 Java가 서비스 DB에서 한다(ADR 0009). 성공한 뒤에만 변경 이력을 남기고, 화면용 상세는 다시 읽어 돌려준다.
  // Java 호출과 이력 기록은 서로 다른 DB라 한 트랜잭션으로 묶을 수 없다. 이력 기록이 실패하면 변경은 남고 이력만 빠진다.

  async assign(actor: MemberRow, id: number, expectedAssigneeId: number | null): Promise<InquiryDetail> {
    const before = await this.reader.get(id);
    if (!before) throw notFound();
    await this.java.assign(id, actor.id, expectedAssigneeId);
    const previous = before.assigneeMemberId;
    if (previous !== actor.id) {
      const previousName = previous === null ? null : await this.displayNameOf(previous);
      await this.record(actor, id, previous === null ? 'INQUIRY_ASSIGNED' : 'INQUIRY_ASSIGNEE_CHANGED', {
        from: previousName,
        to: actor.displayName,
      });
    }
    return this.detail(id);
  }

  async release(actor: MemberRow, id: number): Promise<InquiryDetail> {
    await this.java.release(id, actor.id);
    await this.record(actor, id, 'INQUIRY_ASSIGNEE_RELEASED', { from: actor.displayName, to: null });
    return this.detail(id);
  }

  async restore(actor: MemberRow, id: number): Promise<InquiryDetail> {
    await this.java.restore(id, actor.id);
    // 해제 취소를 가리키는 이력 종류는 아직 정해지지 않아 맡기와 같게 기록한다.
    await this.record(actor, id, 'INQUIRY_ASSIGNED', { from: null, to: actor.displayName });
    return this.detail(id);
  }

  async reply(actor: MemberRow, id: number, body: string): Promise<InquiryDetail> {
    await this.java.reply(id, actor.id, body);
    // 답변 내용은 이력에 남기지 않는다.
    await this.record(actor, id, 'INQUIRY_REPLIED');
    return this.detail(id);
  }

  private async record(
    actor: MemberRow,
    id: number,
    action: 'INQUIRY_ASSIGNED' | 'INQUIRY_ASSIGNEE_CHANGED' | 'INQUIRY_ASSIGNEE_RELEASED' | 'INQUIRY_REPLIED',
    change?: { from: string | null; to: string | null }
  ): Promise<void> {
    await this.database.db.transaction((tx) =>
      recordChange(tx, {
        actor,
        target: { type: 'INQUIRY', id, label: `문의 #${id}` },
        action,
        ...(change ? { change } : {}),
      })
    );
  }

  private async displayNameOf(memberId: number): Promise<string | null> {
    return (await this.membersByIds([memberId])).get(memberId)?.displayName ?? null;
  }

  private filterOf(actor: MemberRow, query: InquiryQuery): InquiryFilter {
    const { assignee, ...rest } = query;
    return { ...rest, ...(assignee === undefined ? {} : { assignee: assignee === 'ME' ? actor.id : assignee }) };
  }

  private async detailOf(row: InquiryDetailRow): Promise<InquiryDetail> {
    const authorIds = row.messages.flatMap((message) =>
      message.authorMemberId === null ? [] : [message.authorMemberId]
    );
    const people = await this.membersByIds([
      ...new Set([...authorIds, ...(row.assigneeMemberId === null ? [] : [row.assigneeMemberId])]),
    ]);
    const assignees = new Map(
      [...people].flatMap(([id, member]) => {
        const assignee = toAssignee(member);
        return assignee ? [[id, assignee] as const] : [];
      })
    );
    return {
      ...toSummary(row, assignees),
      createdAt: row.createdAt,
      messages: row.messages.map((message) => ({
        id: String(message.id),
        author: message.sender,
        authorName:
          message.sender === 'USER'
            ? row.userName
            : ((message.authorMemberId === null ? undefined : people.get(message.authorMemberId)?.displayName) ??
              UNKNOWN_OPERATOR),
        body: message.body,
        createdAt: message.createdAt,
        images: message.images.map((image) => ({
          id: String(image.id),
          url: `${this.imageBaseUrl}/${image.s3Key}`,
          fileName: image.fileName,
        })),
      })),
    };
  }

  private async assigneesOf(rows: InquiryRow[]): Promise<Map<number, InquiryAssignee>> {
    const ids = [...new Set(rows.flatMap((row) => (row.assigneeMemberId === null ? [] : [row.assigneeMemberId])))];
    const people = await this.membersByIds(ids);
    return new Map(
      [...people].flatMap(([id, member]) => {
        const assignee = toAssignee(member);
        return assignee ? [[id, assignee] as const] : [];
      })
    );
  }

  private async membersByIds(ids: number[]): Promise<Map<number, MemberRow>> {
    if (ids.length === 0) return new Map();
    const rows = await this.database.db.select().from(members).where(inArray(members.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }
}

function toAssignee(member: MemberRow): InquiryAssignee | undefined {
  if (member.displayName === null || member.jobRole === null) return undefined;
  return {
    id: member.id,
    email: member.email,
    displayName: member.displayName,
    jobRole: member.jobRole,
    isActive: member.status === 'ACTIVE',
  };
}

function toSummary(row: InquiryRow, assignees: Map<number, InquiryAssignee>): InquirySummary {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    user: { type: row.userType, name: row.userName, email: row.userEmail },
    assignee: row.assigneeMemberId === null ? null : (assignees.get(row.assigneeMemberId) ?? null),
    lastActivityAt: row.lastActivityAt,
  };
}
