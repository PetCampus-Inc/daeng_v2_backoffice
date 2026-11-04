import { NotificationKind, NotificationTargetType } from '@/routes/app/ui/top-bar/ui/notification-center/type';
import type { TeamMember } from '@/routes/settings/members/type/team-member';
import { readStoredNotifications, writeStoredNotifications } from '../../handlers/notifications';

export type NotificationEvent =
  | { type: 'newInquiry'; targetId: number }
  | { type: 'followUp'; targetId: number }
  | { type: 'assigneeChanged'; targetId: number; previousEmail: string | null; actorName: string }
  | { type: 'newIdea'; targetId: number }
  | { type: 'reviewReport'; targetId: number };

/**
 * 서버(`notification-event-processor.ts`)의 수신자 규칙을 따라 하는 모의 서버 규칙이다. 활성 팀원만 받는다.
 * 새 문의와 추가 문의는 최고 관리자·운영자 모두에게, 새 제안은 전 역할에게 가고, 담당자 변경은 이전 담당자에게만 간다.
 * 기획(PRD 8장)은 추가 문의를 담당자에게만 보낸다. 서버가 고쳐지기 전까지 다르다(OQ-D30).
 */
export function getNotificationRecipients(members: TeamMember[], event: NotificationEvent): string[] {
  return members
    .filter((member) => {
      if (member.status !== 'ACTIVE') return false;
      switch (event.type) {
        case 'newInquiry':
        case 'followUp':
          return member.role === 'SUPER_ADMIN' || member.role === 'OPERATOR';
        case 'newIdea':
          return true;
        case 'assigneeChanged':
          return member.email === event.previousEmail;
        case 'reviewReport':
          return false;
      }
    })
    .map((member) => member.email);
}

/** 서버가 알림에 저장하는 문구. 대상 번호는 화면이 뒤에 붙이므로 여기에는 없다. */
export function getNotificationMessage(event: NotificationEvent): string {
  switch (event.type) {
    case 'newInquiry':
      return '새 1:1 문의가 접수되었습니다.';
    case 'followUp':
      return '문의에 사용자가 추가 문의를 남겼습니다.';
    case 'assigneeChanged':
      return `${event.actorName}님이 문의의 담당자를 변경했습니다.`;
    case 'newIdea':
      return '새 아이디어 제안이 접수되었습니다.';
    case 'reviewReport':
      return '';
  }
}

/** 이벤트에 맞는 서버 알림 종류. */
const NOTIFICATION_KINDS = {
  newInquiry: NotificationKind.NEW_INQUIRY,
  followUp: NotificationKind.ADDITIONAL_INQUIRY,
  assigneeChanged: NotificationKind.ASSIGNEE_CHANGED,
  newIdea: NotificationKind.NEW_IDEA,
} as const;

/** 개발용 앱 이벤트·문의 담당자 변경이 쌓는 기록. 프론트에서 호출하지 않는다. */
export function recordMockNotification(members: TeamMember[], event: NotificationEvent) {
  if (event.type === 'reviewReport') return;
  const recipients = getNotificationRecipients(members, event);
  if (recipients.length === 0) return;
  const stored = readStoredNotifications();
  let nextId = Math.max(0, ...stored.map((item) => item.id)) + 1;
  const createdAt = new Date().toISOString();
  const records = recipients.map((recipientEmail) => ({
    id: nextId++,
    recipientEmail,
    kind: NOTIFICATION_KINDS[event.type],
    message: getNotificationMessage(event),
    targetType: event.type === 'newIdea' ? NotificationTargetType.IDEA : NotificationTargetType.INQUIRY,
    targetId: event.targetId,
    createdAt,
    readAt: null,
  }));
  writeStoredNotifications([...stored, ...records]);
}
