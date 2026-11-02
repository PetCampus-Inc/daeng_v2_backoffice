import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { NotificationEventClient } from './notification-event-client.js';
import { NotificationEventProcessor } from './notification-event-processor.js';
import { notificationEventSchema } from './notification-events.js';

const POLL_INTERVAL_MS = 10_000;
const MAX_PAGES_PER_POLL = 20;
@Injectable()
export class NotificationEventPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventPoller.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private cursor?: string;
  constructor(
    @Inject(NotificationEventClient) private readonly client: NotificationEventClient,
    @Inject(NotificationEventProcessor) private readonly processor: NotificationEventProcessor
  ) {}
  onModuleInit() {
    const enabled = process.env.NOTIFICATION_POLL_ENABLED;
    if (enabled !== undefined && enabled !== '' && enabled !== 'true' && enabled !== 'false')
      throw new Error('NOTIFICATION_POLL_ENABLED must be "true" or "false"');
    if (enabled !== 'true') return;
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
        const result = await this.client.list(this.cursor);
        for (const raw of result.items) {
          const parsed = notificationEventSchema.safeParse(raw);
          if (!parsed.success) {
            this.logger.error('Java 알림 이벤트 형식 오류: 처리를 보류합니다.');
            continue;
          }
          if (Date.now() - Date.parse(parsed.data.occurredAt) > 300_000)
            this.logger.warn(`5분 이상 지연된 알림 이벤트: ${parsed.data.eventId}`);
          try {
            await this.processor.process(parsed.data);
            await this.client.complete(parsed.data.eventId);
          } catch (error) {
            this.logger.error(
              `알림 이벤트 처리 또는 완료 실패: ${parsed.data.eventId}`,
              error instanceof Error ? error.stack : String(error)
            );
          }
        }
        const next = result.nextAfterId;
        if (next === null) {
          this.cursor = undefined;
          break;
        }
        if (this.cursor && BigInt(next) <= BigInt(this.cursor))
          throw new Error('Java notification event cursor did not advance');
        this.cursor = next;
      }
    } catch (error) {
      this.logger.error('Java 알림 이벤트 조회 실패', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
