import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { accessLogs, type AccessEvent, type AccessResult } from '../database/schema.js';

export interface AccessLogEntry {
  event: AccessEvent;
  result: AccessResult;
  /** 이메일을 얻지 못한 실패는 null */
  email: string | null;
}

@Injectable()
export class AccessLogService {
  private readonly logger = new Logger(AccessLogService.name);

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 기록에 실패해도 로그인·로그아웃 자체는 막지 않고 서버 로그에만 남긴다. */
  async record(entry: AccessLogEntry): Promise<void> {
    try {
      await this.database.db.insert(accessLogs).values(entry);
    } catch (error) {
      this.logger.error(
        `Failed to write the access log (${entry.event}/${entry.result})`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
