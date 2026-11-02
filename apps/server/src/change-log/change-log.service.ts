import { Inject, Injectable } from '@nestjs/common';
import { ChangeLogReader, type ChangeLogRow } from './change-log-reader.js';
import type { ChangeLogsQuery } from './change-log.schemas.js';

/** 저장된 행을 명세의 응답으로 바꾼다. 행위자의 표시명·직무와 대상 라벨은 기록 당시 값을 그대로 쓴다. */
function toChangeLog(row: ChangeLogRow) {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actor: {
      id: row.actorMemberId,
      displayName: row.actorDisplayName,
      jobRole: row.actorJobRole,
      email: row.actorEmail,
    },
    targetType: row.targetType,
    target: { id: row.targetId, label: row.targetLabel },
    action: row.action,
    // 역할 변경·담당자 변경처럼 변경 전후 값이 있을 때만 채운다.
    change: row.beforeValue === null && row.afterValue === null ? null : { from: row.beforeValue, to: row.afterValue },
  };
}

@Injectable()
export class ChangeLogService {
  constructor(@Inject(ChangeLogReader) private readonly reader: ChangeLogReader) {}

  async list(query: ChangeLogsQuery) {
    const { total, rows } = await this.reader.list(query);
    return {
      items: rows.map(toChangeLog),
      page: query.page,
      size: query.size,
      totalItems: total,
      totalPages: Math.ceil(total / query.size),
    };
  }
}
