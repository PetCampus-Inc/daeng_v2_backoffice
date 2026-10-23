import { http } from 'msw';
import { authenticateMockRequest } from '../util/session';
import { errorResponse, mockUrl, okResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';
import type { Notification } from '@/routes/app/ui/top-bar/ui/notification-center/type/notification';

const STORAGE_KEY = 'daeng-bo-mock-notifications';
const READ_STORAGE_KEY = 'daeng-bo-mock-notification-reads';

type StoredNotification = Partial<Notification> & {
  recipientEmail: string;
  message: string;
  inquiryId?: number;
  createdAt: string;
};

/** fixtures.md 알림-기본. 조회자에게는 역할 변경 전에 받은 과거 알림도 남는다. */
const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'fixture-1',
    message: '새 1:1 문의가 등록되었습니다. 문의 #1041',
    targetType: 'inquiry',
    targetId: 1041,
    createdAt: '2026-10-07T09:30:00+09:00',
    isRead: false,
  },
  {
    id: 'fixture-2',
    message: '이담당 · FE님이 문의의 담당자를 변경했습니다.',
    targetType: 'inquiry',
    targetId: 1045,
    createdAt: '2026-10-06T12:00:00+09:00',
    isRead: true,
  },
  {
    id: 'fixture-3',
    message: '새 아이디어 제안이 등록되었습니다. 제안 #350',
    targetType: 'idea',
    targetId: 350,
    createdAt: '2026-10-06T09:00:00+09:00',
    isRead: false,
  },
  {
    id: 'fixture-4',
    message: '담당 중인 문의에 추가 문의가 왔습니다. 문의 #1050',
    targetType: 'inquiry',
    targetId: 1050,
    createdAt: '2026-10-05T20:00:00+09:00',
    isRead: false,
  },
];

function readStored<TValue>(key: string, fallback: TValue): TValue {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

/** 기존 문의 핸들러의 담당자 변경 기록도 읽는다. 명시적으로 저장한 []는 빈 목록 fixture다. */
function getNotifications(email: string): Notification[] {
  let stored = readStored<StoredNotification[] | null>(STORAGE_KEY, null);
  if (!Array.isArray(stored)) {
    stored = getMockTeamMembers()
      .filter((member) => member.status === 'active')
      .flatMap((member) => DEFAULT_NOTIFICATIONS.map((item) => ({ ...item, recipientEmail: member.email })));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
  const reads = readStored<Record<string, string[]>>(READ_STORAGE_KEY, {});
  const items = stored
    .map((item, index) => ({ ...item, id: item.id ?? `event-${index}` }))
    .filter((item) => item.recipientEmail === email)
    .map((item): Notification => ({
      id: item.id,
      message: item.message,
      targetType: item.targetType ?? 'inquiry',
      targetId: item.targetId ?? item.inquiryId!,
      createdAt: item.createdAt,
      isRead: item.isRead ?? false,
    }));
  return items
    .map((item) => ({ ...item, isRead: item.isRead || (reads[email] ?? []).includes(item.id) }))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function markRead(email: string, ids: string[]) {
  const reads = readStored<Record<string, string[]>>(READ_STORAGE_KEY, {});
  reads[email] = [...new Set([...(reads[email] ?? []), ...ids])];
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(reads));
  return okResponse(getNotifications(email));
}

export const NOTIFICATION_HANDLERS = [
  http.get(mockUrl('/notifications'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    return okResponse(getNotifications(auth.member.email));
  }),
  http.patch(mockUrl('/notifications/read-all'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    return markRead(
      auth.member.email,
      getNotifications(auth.member.email).map((item) => item.id)
    );
  }),
  http.patch(mockUrl('/notifications/:id/read'), ({ params }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const item = getNotifications(auth.member.email).find((item) => item.id === params.id);
    if (!item) {
      return errorResponse(404, {
        code: 'NOTIFICATION_NOT_FOUND',
        message: '알림을 찾을 수 없습니다.',
        errorMessage: '알림을 찾을 수 없습니다.',
      });
    }
    return markRead(auth.member.email, [item.id]);
  }),
];
