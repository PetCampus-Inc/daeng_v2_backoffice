import type { TeamMember } from '@/routes/settings/members/type/team-member';

export type NotificationEvent =
  | { type: 'newInquiry'; targetId: number }
  | { type: 'followUp'; targetId: number; assigneeEmail: string | null }
  | { type: 'assigneeChanged'; targetId: number; previousEmail: string | null; actorName: string }
  | { type: 'newIdea'; targetId: number }
  | { type: 'reviewReport'; targetId: number };

/** PRD 8장. 실제 서버의 수신자 판정을 대신 검증하는 모의 서버 규칙이다. */
export function getNotificationRecipients(members: TeamMember[], event: NotificationEvent): string[] {
  return members
    .filter((member) => {
      if (member.status !== 'active') return false;
      switch (event.type) {
        case 'newInquiry':
          return member.role === 'superAdmin' || member.role === 'operator';
        case 'newIdea':
          return true;
        case 'followUp':
          return member.email === event.assigneeEmail;
        case 'assigneeChanged':
          return member.email === event.previousEmail;
        case 'reviewReport':
          return false;
      }
    })
    .map((member) => member.email);
}

export function getNotificationMessage(event: NotificationEvent): string {
  switch (event.type) {
    case 'newInquiry':
      return `새 1:1 문의가 등록되었습니다. 문의 #${event.targetId}`;
    case 'followUp':
      return `담당 중인 문의에 추가 문의가 왔습니다. 문의 #${event.targetId}`;
    case 'assigneeChanged':
      return `${event.actorName}님이 문의의 담당자를 변경했습니다.`;
    case 'newIdea':
      return `새 아이디어 제안이 등록되었습니다. 제안 #${event.targetId}`;
    case 'reviewReport':
      return '';
  }
}

/** 개발용 앱 이벤트·문의 담당자 변경이 쌓는 기록. 프론트에서 호출하지 않는다. */
export function recordMockNotification(members: TeamMember[], event: NotificationEvent) {
  const recipients = getNotificationRecipients(members, event);
  if (recipients.length === 0) return;
  const key = 'daeng-bo-mock-notifications';
  let stored: unknown = [];
  try {
    stored = JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    /* 개발 데이터 초기화 */
  }
  const id = crypto.randomUUID();
  const records = recipients.map((recipientEmail) => ({
    id,
    recipientEmail,
    message: getNotificationMessage(event),
    targetType: event.type === 'newIdea' ? 'idea' : 'inquiry',
    targetId: event.targetId,
    inquiryId: event.type === 'newIdea' ? undefined : event.targetId,
    createdAt: new Date().toISOString(),
    isRead: false,
  }));
  localStorage.setItem(key, JSON.stringify([...(Array.isArray(stored) ? stored : []), ...records]));
}
