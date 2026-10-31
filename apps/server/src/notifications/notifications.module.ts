import { Module } from '@nestjs/common';
import { JavaApiModule } from '../java-api/java-api.module.js';
import { NotificationEventClient } from './notification-event-client.js';
import { NotificationEventProcessor } from './notification-event-processor.js';
import { NotificationEventPoller } from './notification-event-poller.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
@Module({
  imports: [JavaApiModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventClient, NotificationEventProcessor, NotificationEventPoller],
})
export class NotificationsModule {}
