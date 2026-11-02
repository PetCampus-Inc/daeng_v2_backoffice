import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { changeLogsQuerySchema, type ChangeLogsQuery } from './change-log.schemas.js';
import { ChangeLogService } from './change-log.service.js';

/** 변경 이력 조회(최고 관리자만). 조회는 이력으로 남기지 않는다. */
@Roles('SUPER_ADMIN')
@Controller('change-logs')
export class ChangeLogController {
  constructor(@Inject(ChangeLogService) private readonly changeLogs: ChangeLogService) {}

  @Get()
  list(@Query(new ZodValidationPipe(changeLogsQuerySchema)) query: ChangeLogsQuery) {
    return this.changeLogs.list(query);
  }
}
