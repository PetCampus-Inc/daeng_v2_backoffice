import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { addDays, kstStartOfDay } from '../common/time.js';
import { DatabaseService } from '../database/database.service.js';
import { changeLogs } from '../database/schema.js';
import type { ChangeLogsQuery } from './change-log.schemas.js';

export type ChangeLogRow = typeof changeLogs.$inferSelect;

@Injectable()
export class ChangeLogReader {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 최신순, 같은 시각이면 ID 내림차순이다. 기간은 KST 날짜 기준이고 종료일을 포함한다. */
  async list(query: ChangeLogsQuery): Promise<{ total: number; rows: ChangeLogRow[] }> {
    const conditions: SQL[] = [];
    if (query.from) conditions.push(gte(changeLogs.occurredAt, kstStartOfDay(query.from)));
    if (query.to) conditions.push(lt(changeLogs.occurredAt, kstStartOfDay(addDays(query.to, 1))));
    if (query.actorId !== undefined) conditions.push(eq(changeLogs.actorMemberId, query.actorId));
    if (query.targetType) conditions.push(eq(changeLogs.targetType, query.targetType));
    const where = conditions.length ? and(...conditions) : undefined;
    const { db } = this.database;
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(changeLogs)
        .where(where)
        .orderBy(desc(changeLogs.occurredAt), desc(changeLogs.id))
        .limit(query.size)
        .offset((query.page - 1) * query.size),
      db.select({ total: count() }).from(changeLogs).where(where),
    ]);
    return { total: totals[0]?.total ?? 0, rows };
  }
}
