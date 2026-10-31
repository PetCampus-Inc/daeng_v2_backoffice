import { z } from 'zod';

// Java는 이벤트 ID를 JSON 숫자로 주고 JS 안전 정수 범위에 있다. BO DB의 키는 문자열이라 읽을 때 문자열로 바꾼다.
const eventId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String);
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const eventFields = {
  eventId,
  schemaVersion: z.literal(1),
  targetId: id,
  occurredAt: z.iso.datetime({ offset: true }),
};
export const notificationEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...eventFields,
    type: z.literal('NEW_INQUIRY'),
    targetType: z.literal('INQUIRY'),
    messageId: z.null(),
    previousAssigneeId: z.null(),
    actorMemberId: z.null(),
  }),
  z.object({
    ...eventFields,
    type: z.literal('ADDITIONAL_INQUIRY'),
    targetType: z.literal('INQUIRY'),
    messageId: id,
    previousAssigneeId: z.null(),
    actorMemberId: z.null(),
  }),
  z.object({
    ...eventFields,
    type: z.literal('ASSIGNEE_CHANGED'),
    targetType: z.literal('INQUIRY'),
    messageId: z.null(),
    previousAssigneeId: id,
    actorMemberId: id,
  }),
  z.object({
    ...eventFields,
    type: z.literal('NEW_IDEA'),
    targetType: z.literal('IDEA'),
    messageId: z.null(),
    previousAssigneeId: z.null(),
    actorMemberId: z.null(),
  }),
]);
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export const eventPageSchema = z.object({
  data: z.object({ items: z.array(z.unknown()).max(50), nextAfterId: eventId.nullable() }),
});
