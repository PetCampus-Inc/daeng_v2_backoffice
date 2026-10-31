import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import { kstToIso } from '../common/time.js';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import {
  serviceInquiries,
  serviceInquiryImages,
  serviceInquiryMessages,
  serviceUsers,
  socialUsers,
  type ServiceInquiryStatus,
} from '../service-database/service-schema.js';

export type InquiryUserType = 'GUARDIAN' | 'DIRECTOR';
export type InquirySort = 'LATEST' | 'OLDEST';

export interface InquiryFilter {
  keyword?: string;
  status?: ServiceInquiryStatus;
  userType?: InquiryUserType;
  /** 미배정이거나 특정 팀원 ID. 전체는 생략한다. */
  assignee?: 'UNASSIGNED' | number;
  sort: InquirySort;
}

export interface InquiryRow {
  id: number;
  status: ServiceInquiryStatus;
  title: string;
  userType: InquiryUserType;
  userName: string;
  userEmail: string;
  assigneeMemberId: number | null;
  /** ISO 8601 UTC */
  lastActivityAt: string;
  createdAt: string;
}

export interface InquiryMessageRow {
  id: number;
  sender: 'USER' | 'OPERATOR';
  authorMemberId: number | null;
  body: string;
  createdAt: string;
  images: Array<{ id: number; s3Key: string; fileName: string }>;
}

export interface InquiryDetailRow extends InquiryRow {
  messages: InquiryMessageRow[];
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

// 문의자 이름·이메일은 소셜 가입 정보에서 가져온다. 이름이 없으면 닉네임을 쓴다.
const userNameSql = () =>
  sql<
    string | null
  >`coalesce((select ${socialUsers.name} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1), ${serviceUsers.nickname})`;
const userEmailSql = () =>
  sql<
    string | null
  >`(select ${socialUsers.email} from ${socialUsers} where ${socialUsers.userId} = ${serviceUsers.userId} order by ${socialUsers.id} limit 1)`;

/** 서비스 DB를 읽기 전용으로 조회한다(ADR 0009). */
@Injectable()
export class InquiryReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  async list(filter: InquiryFilter, page: number, size: number): Promise<{ rows: InquiryRow[]; total: number }> {
    const { db } = this.service;
    const where = this.where(filter);
    const [counted] = await db
      .select({ total: count() })
      .from(serviceInquiries)
      .innerJoin(serviceUsers, eq(serviceInquiries.userId, serviceUsers.id))
      .where(where);
    const rows = await this.selectRows()
      .where(where)
      .orderBy(...this.order(filter.sort))
      .limit(size)
      .offset((page - 1) * size);
    return { rows: rows.map(toRow), total: counted?.total ?? 0 };
  }

  /** 문의가 없으면 undefined, 조건에 맞는 목록에 없으면 앞뒤가 모두 null이다. */
  async adjacent(
    id: number,
    filter: InquiryFilter
  ): Promise<{ prevId: number | null; nextId: number | null } | undefined> {
    const { db } = this.service;
    const [exists] = await db
      .select({ id: serviceInquiries.id })
      .from(serviceInquiries)
      .where(eq(serviceInquiries.id, id))
      .limit(1);
    if (!exists) return undefined;
    const ordered = await db
      .select({ id: serviceInquiries.id })
      .from(serviceInquiries)
      .innerJoin(serviceUsers, eq(serviceInquiries.userId, serviceUsers.id))
      .where(this.where(filter))
      .orderBy(...this.order(filter.sort));
    const index = ordered.findIndex((row) => row.id === id);
    if (index === -1) return { prevId: null, nextId: null };
    return { prevId: ordered[index - 1]?.id ?? null, nextId: ordered[index + 1]?.id ?? null };
  }

  async get(id: number): Promise<InquiryDetailRow | undefined> {
    const { db } = this.service;
    const [row] = await this.selectRows().where(eq(serviceInquiries.id, id)).limit(1);
    if (!row) return undefined;
    const messages = await db
      .select()
      .from(serviceInquiryMessages)
      .where(eq(serviceInquiryMessages.inquiryId, id))
      .orderBy(asc(serviceInquiryMessages.id));
    const images =
      messages.length === 0
        ? []
        : await db
            .select()
            .from(serviceInquiryImages)
            .where(
              inArray(
                serviceInquiryImages.messageId,
                messages.map((message) => message.id)
              )
            )
            .orderBy(asc(serviceInquiryImages.messageId), asc(serviceInquiryImages.displayOrder));
    return {
      ...toRow(row),
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        authorMemberId: message.authorMemberId,
        body: message.body,
        createdAt: kstToIso(message.createdAt),
        images: images
          .filter((image) => image.messageId === message.id)
          .map((image) => ({ id: image.id, s3Key: image.s3Key, fileName: image.originalFilename ?? image.s3Key })),
      })),
    };
  }

  private selectRows() {
    return this.service.db
      .select({
        id: serviceInquiries.id,
        status: serviceInquiries.status,
        title: serviceInquiries.title,
        inquirerType: serviceInquiries.inquirerType,
        assigneeMemberId: serviceInquiries.assigneeMemberId,
        lastActivityAt: serviceInquiries.lastActivityAt,
        createdAt: serviceInquiries.createdAt,
        userName: userNameSql().as('user_name'),
        userEmail: userEmailSql().as('user_email'),
      })
      .from(serviceInquiries)
      .innerJoin(serviceUsers, eq(serviceInquiries.userId, serviceUsers.id));
  }

  /** 최근 활동순이고, 같으면 ID 내림차순이다. */
  private order(sort: InquirySort) {
    return [
      sort === 'LATEST' ? desc(serviceInquiries.lastActivityAt) : asc(serviceInquiries.lastActivityAt),
      desc(serviceInquiries.id),
    ];
  }

  private where(filter: InquiryFilter): SQL | undefined {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(serviceInquiries.status, filter.status));
    if (filter.userType) {
      conditions.push(eq(serviceInquiries.inquirerType, filter.userType === 'DIRECTOR' ? 'OWNER' : 'GUARDIAN'));
    }
    if (filter.assignee === 'UNASSIGNED') conditions.push(isNull(serviceInquiries.assigneeMemberId));
    else if (typeof filter.assignee === 'number')
      conditions.push(eq(serviceInquiries.assigneeMemberId, filter.assignee));
    if (filter.keyword) {
      const pattern = `%${escapeLike(filter.keyword.toLowerCase())}%`;
      conditions.push(
        or(
          sql`lower(${serviceInquiries.title}) like ${pattern}`,
          sql`lower(${userNameSql()}) like ${pattern}`,
          sql`lower(${userEmailSql()}) like ${pattern}`,
          like(sql`cast(${serviceInquiries.id} as char)`, pattern),
          sql`exists (select 1 from ${serviceInquiryMessages} where ${serviceInquiryMessages.inquiryId} = ${serviceInquiries.id} and lower(${serviceInquiryMessages.body}) like ${pattern})`
        )!
      );
    }
    return and(...conditions);
  }
}

function toRow(row: {
  id: number;
  status: ServiceInquiryStatus;
  title: string;
  inquirerType: string;
  assigneeMemberId: number | null;
  lastActivityAt: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}): InquiryRow {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    userType: row.inquirerType === 'OWNER' ? 'DIRECTOR' : 'GUARDIAN',
    userName: row.userName ?? '',
    userEmail: row.userEmail ?? '',
    assigneeMemberId: row.assigneeMemberId,
    lastActivityAt: kstToIso(row.lastActivityAt),
    createdAt: kstToIso(row.createdAt),
  };
}
