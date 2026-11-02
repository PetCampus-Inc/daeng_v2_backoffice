import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import { notifications } from '../database/schema.js';

type NotificationRow = typeof notifications.$inferSelect;
function toNotification(row: NotificationRow) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}
@Injectable()
export class NotificationsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async list(memberId: number, page: number, size: number) {
    const where = eq(notifications.recipientId, memberId);
    const [rows, totals] = await Promise.all([
      this.database.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(size)
        .offset((page - 1) * size),
      this.database.db.select({ count: count() }).from(notifications).where(where),
    ]);
    const totalItems = totals[0]?.count ?? 0;
    return { items: rows.map(toNotification), page, size, totalItems, totalPages: Math.ceil(totalItems / size) };
  }
  async unreadCount(memberId: number) {
    const [result] = await this.database.db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.recipientId, memberId), isNull(notifications.readAt)));
    return { count: result?.count ?? 0 };
  }
  async read(memberId: number, id: number) {
    const where = and(eq(notifications.id, id), eq(notifications.recipientId, memberId));
    await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(where, isNull(notifications.readAt)));
    const [row] = await this.database.db.select().from(notifications).where(where).limit(1);
    if (!row) throw new ApiException(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.');
    return toNotification(row);
  }
  async readAll(memberId: number) {
    await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientId, memberId), isNull(notifications.readAt)));
  }
}
