import { Module } from '@nestjs/common';
import { ChangeLogController } from './change-log.controller.js';
import { ChangeLogReader } from './change-log-reader.js';
import { ChangeLogService } from './change-log.service.js';

@Module({
  controllers: [ChangeLogController],
  providers: [ChangeLogReader, ChangeLogService],
})
export class ChangeLogModule {}
