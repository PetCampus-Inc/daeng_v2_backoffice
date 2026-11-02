import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { isDuplicateEntry } from '../database/errors.js';
import { members, notifications, processedNotificationEvents, type MemberRole } from '../database/schema.js';
import type { NotificationEvent } from './notification-events.js';

const messages = {
  NEW_INQUIRY: '새 1:1 문의가 접수되었습니다.',
  ADDITIONAL_INQUIRY: '문의에 사용자가 추가 문의를 남겼습니다.',
  NEW_IDEA: '새 아이디어 제안이 접수되었습니다.',
} as const;
@Injectable()
export class NotificationEventProcessor {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async process(event: NotificationEvent): Promise<void> {
    try {
      await this.database.db.transaction(async (tx) => {
        await tx.insert(processedNotificationEvents).values({ eventId: event.eventId });
        let recipients: { id: number }[];
        let message: string;
        if (event.type === 'ASSIGNEE_CHANGED') {
          if (event.actorMemberId === event.previousAssigneeId) return;
          recipients = await tx
            .select({ id: members.id })
            .from(members)
            .where(and(eq(members.id, event.previousAssigneeId), eq(members.status, 'ACTIVE')));
          // 수신자가 없을 때는 처리 기록만 남긴다. 변경자의 프로필이 없어도 재시도할 필요가 없다.
          if (!recipients.length) return;
          const [actor] = await tx
            .select({ displayName: members.displayName, jobRole: members.jobRole })
            .from(members)
            .where(eq(members.id, event.actorMemberId))
            .limit(1);
          if (!actor?.displayName || !actor.jobRole) throw new Error('Notification actor profile is unavailable');
          message = `${actor.displayName} · ${actor.jobRole}님이 문의의 담당자를 변경했습니다.`;
        } else {
          message = messages[event.type];
          const roles: MemberRole[] =
            event.type === 'NEW_IDEA' ? ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] : ['SUPER_ADMIN', 'OPERATOR'];
          recipients = await tx
            .select({ id: members.id })
            .from(members)
            .where(and(eq(members.status, 'ACTIVE'), inArray(members.role, roles)));
        }
        if (recipients.length)
          await tx.insert(notifications).values(
            recipients.map(({ id }) => ({
              recipientId: id,
              eventId: event.eventId,
              kind: event.type,
              message,
              targetType: event.targetType,
              targetId: event.targetId,
            }))
          );
      });
    } catch (error) {
      // 해당 이벤트의 처리 기록이 이미 커밋된 경우에만 성공으로 간주한다.
      if (isDuplicateEntry(error)) {
        const [processed] = await this.database.db
          .select({ eventId: processedNotificationEvents.eventId })
          .from(processedNotificationEvents)
          .where(eq(processedNotificationEvents.eventId, event.eventId))
          .limit(1);
        if (processed) return;
      }
      throw error;
    }
  }
}
