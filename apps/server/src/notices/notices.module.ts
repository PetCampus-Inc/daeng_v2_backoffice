import { Module } from '@nestjs/common';
import { JavaApiModule } from '../java-api/java-api.module.js';
import { NoticeJavaClient } from './notice-java.client.js';
import { NoticesController } from './notices.controller.js';
import { NoticesService } from './notices.service.js';

@Module({
  imports: [JavaApiModule],
  controllers: [NoticesController],
  providers: [NoticeJavaClient, NoticesService],
})
export class NoticesModule {}
