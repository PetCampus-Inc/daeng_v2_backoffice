import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { ServiceDatabaseService } from '../service-database/service-database.service.js';
import { escapeLike, kstToIso, userEmailSql, userNameSql } from '../service-database/service-queries.js';
import { serviceIdeas, serviceUsers } from '../service-database/service-schema.js';

export type IdeaUserType = 'GUARDIAN' | 'DIRECTOR';
export type IdeaSort = 'LATEST' | 'OLDEST';

export interface IdeaFilter {
  keyword?: string;
  userType?: IdeaUserType;
  sort: IdeaSort;
}

export interface IdeaRow {
  id: number;
  content: string;
  userType: IdeaUserType;
  userName: string;
  userEmail: string;
  /** ISO 8601 UTC */
  submittedAt: string;
}

/** 서비스 DB의 아이디어 제안을 읽기 전용으로 조회한다(ADR 0009). */
@Injectable()
export class IdeaReader {
  constructor(@Inject(ServiceDatabaseService) private readonly service: ServiceDatabaseService) {}

  async list(filter: IdeaFilter, page: number, size: number): Promise<{ rows: IdeaRow[]; total: number }> {
    const where = this.where(filter);
    const [counted] = await this.service.db
      .select({ total: count() })
      .from(serviceIdeas)
      .innerJoin(serviceUsers, eq(serviceIdeas.userId, serviceUsers.id))
      .where(where);
    const rows = await this.selectRows()
      .where(where)
      .orderBy(...this.order(filter.sort))
      .limit(size)
      .offset((page - 1) * size);
    return { rows: rows.map(toRow), total: counted?.total ?? 0 };
  }

  async get(id: number): Promise<IdeaRow | undefined> {
    const [row] = await this.selectRows().where(eq(serviceIdeas.id, id)).limit(1);
    return row ? toRow(row) : undefined;
  }

  private selectRows() {
    return this.service.db
      .select({
        id: serviceIdeas.id,
        content: serviceIdeas.content,
        inquirerType: serviceIdeas.inquirerType,
        createdAt: serviceIdeas.createdAt,
        userName: userNameSql().as('user_name'),
        userEmail: userEmailSql().as('user_email'),
      })
      .from(serviceIdeas)
      .innerJoin(serviceUsers, eq(serviceIdeas.userId, serviceUsers.id));
  }

  /** 제출 시각순이고, 같으면 ID 내림차순이다. */
  private order(sort: IdeaSort) {
    return [sort === 'LATEST' ? desc(serviceIdeas.createdAt) : asc(serviceIdeas.createdAt), desc(serviceIdeas.id)];
  }

  private where(filter: IdeaFilter): SQL | undefined {
    const conditions: SQL[] = [];
    if (filter.userType) {
      conditions.push(eq(serviceIdeas.inquirerType, filter.userType === 'DIRECTOR' ? 'OWNER' : 'GUARDIAN'));
    }
    if (filter.keyword) {
      const pattern = `%${escapeLike(filter.keyword.toLowerCase())}%`;
      conditions.push(
        or(
          sql`lower(${serviceIdeas.content}) like ${pattern}`,
          sql`lower(${userNameSql()}) like ${pattern}`,
          sql`lower(${userEmailSql()}) like ${pattern}`
        )!
      );
    }
    return and(...conditions);
  }
}

function toRow(row: {
  id: number;
  content: string;
  inquirerType: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}): IdeaRow {
  return {
    id: row.id,
    content: row.content,
    userType: row.inquirerType === 'OWNER' ? 'DIRECTOR' : 'GUARDIAN',
    userName: row.userName ?? '',
    userEmail: row.userEmail ?? '',
    submittedAt: kstToIso(row.createdAt),
  };
}
