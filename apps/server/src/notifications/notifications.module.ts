import { Module } from '@nestjs/common';
import { JAVA_API_CONFIG } from '../java-api/java-api.client.js';
import { readJavaApiConfig } from '../java-api/java-api.config.js';
import { NotificationEventClient } from './notification-event-client.js';
import { NotificationEventProcessor } from './notification-event-processor.js';
import { NotificationEventPoller } from './notification-event-poller.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEventClient,
    NotificationEventProcessor,
    NotificationEventPoller,
    { provide: JAVA_API_CONFIG, useFactory: () => readJavaApiConfig(process.env) },
  ],
})
export class NotificationsModule {}
