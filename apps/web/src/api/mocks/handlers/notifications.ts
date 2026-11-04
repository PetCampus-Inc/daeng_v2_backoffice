import { http, HttpResponse } from 'msw';
import type {
  Notification,
  NotificationPage,
  UnreadNotificationCount,
} from '@/routes/app/ui/top-bar/ui/notification-center/type';
import { NotificationKind, NotificationTargetType } from '@/routes/app/ui/top-bar/ui/notification-center/type';
import { NotificationNotFoundErrorCode } from '@/routes/app/ui/top-bar/ui/notification-center/type/notification-not-found-error-code';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import { getMockTeamMembers } from './team-members';

/** 알림 저장 키. 개발용 앱 이벤트(`recordMockNotification`)도 같은 키에 쌓는다. */
export const NOTIFICATION_STORAGE_KEY = 'daeng-bo-mock-notifications';

/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

/** 저장된 알림. 서버 알림에 받는 사람 이메일을 더한 것이다. */
export type StoredNotification = Notification & { recipientEmail: string };

/** 저장된 값이 새 모양(숫자 ID·`readAt`)의 알림인지. 옛 모양이면 기본값으로 복구한다. */
const isStoredNotification = (value: unknown): value is StoredNotification => {
  const item = value as Partial<StoredNotification> | null;
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'number' &&
    typeof item.recipientEmail === 'string' &&
    typeof item.message === 'string' &&
    typeof item.targetId === 'number' &&
    typeof item.createdAt === 'string' &&
    item.readAt !== undefined
  );
};

type DefaultNotification = Omit<Notification, 'id'>;

/**
 * fixtures.md 알림-기본. 문구는 서버가 만드는 그대로(번호 없음)이고 화면이 번호를 붙인다.
 * 조회자에게는 역할 변경 전에 받은 과거 알림도 남는다.
 */
const DEFAULT_NOTIFICATIONS: DefaultNotification[] = [
  {
    kind: NotificationKind.NEW_INQUIRY,
    message: '새 1:1 문의가 접수되었습니다.',
    targetType: NotificationTargetType.INQUIRY,
    targetId: 1041,
    createdAt: new Date('2026-10-07T09:30:00+09:00').toISOString(),
    readAt: null,
  },
  {
    kind: NotificationKind.ASSIGNEE_CHANGED,
    message: '이담당 · FE님이 문의의 담당자를 변경했습니다.',
    targetType: NotificationTargetType.INQUIRY,
    targetId: 1045,
    createdAt: new Date('2026-10-06T12:00:00+09:00').toISOString(),
    readAt: new Date('2026-10-06T12:30:00+09:00').toISOString(),
  },
  {
    kind: NotificationKind.NEW_IDEA,
    message: '새 아이디어 제안이 접수되었습니다.',
    targetType: NotificationTargetType.IDEA,
    targetId: 350,
    createdAt: new Date('2026-10-06T09:00:00+09:00').toISOString(),
    readAt: null,
  },
  {
    kind: NotificationKind.ADDITIONAL_INQUIRY,
    message: '문의에 사용자가 추가 문의를 남겼습니다.',
    targetType: NotificationTargetType.INQUIRY,
    targetId: 1050,
    createdAt: new Date('2026-10-05T20:00:00+09:00').toISOString(),
    readAt: null,
  },
];

/** 저장된 알림을 읽는다. 없거나 옛 모양이면 활성 팀원마다 기본 4건을 만들어 저장한다. 명시적으로 저장한 []는 빈 목록이다. */
export function readStoredNotifications(): StoredNotification[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored) && stored.every(isStoredNotification)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  const seeded = getMockTeamMembers()
    .filter((member) => member.status === 'ACTIVE')
    .flatMap((member, memberIndex) =>
      DEFAULT_NOTIFICATIONS.map((item, index): StoredNotification => ({
        ...item,
        id: memberIndex * DEFAULT_NOTIFICATIONS.length + index + 1,
        recipientEmail: member.email,
      }))
    );
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

/** 알림 전체를 저장한다. */
export const writeStoredNotifications = (items: StoredNotification[]) =>
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));

/** 서버처럼 만든 시각 최근순, 같으면 번호가 큰 것이 먼저다. */
const compareNotifications = (left: Notification, right: Notification) =>
  Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id;

/** 받는 사람의 알림 목록(최근순). 서버 응답에는 받는 사람 이메일이 없다. */
const listNotificationsOf = (email: string): Notification[] =>
  readStoredNotifications()
    .filter((item) => item.recipientEmail === email)
    .map(({ recipientEmail: _recipientEmail, ...item }) => item)
    .sort(compareNotifications);

/** 입력 검증 실패 응답(400). 서버처럼 어느 값이 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (field: string, reason: string) =>
  HttpResponse.json(
    {
      code: ValidationFailedErrorCode.VALIDATION_FAILED,
      message: '입력값을 확인해 주세요.',
      details: [{ field, reason }],
    },
    { status: 400 }
  );

/** 받는 사람의 알림을 읽음 처리해 저장한다. 이미 읽은 알림의 읽은 시각은 그대로 둔다. */
function markRead(email: string, shouldMark: (item: Notification) => boolean) {
  const readAt = new Date().toISOString();
  writeStoredNotifications(
    readStoredNotifications().map((item) =>
      item.recipientEmail === email && item.readAt === null && shouldMark(item) ? { ...item, readAt } : item
    )
  );
}

/**
 * 알림 가짜 API. 서버와 같게 응답을 `data`로 감싸지 않고 페이지는 1부터 센다(기본 20건).
 * 읽음 처리는 `POST`이고, 없거나 남의 알림은 `404 NOTIFICATION_NOT_FOUND`, 1 이상의 정수가 아닌 번호와
 * `page`·`size`는 400이다. 모두 읽음은 본문 없는 204다.
 */
export const NOTIFICATION_HANDLERS = [
  http.get(mockUrl('/notifications'), ({ request }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const params = new URL(request.url).searchParams;
    const page = Number(params.get('page') ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return rejectInvalidInput('page', '1 이상의 정수여야 합니다.');
    const size = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    if (!Number.isSafeInteger(size) || size < 1 || size > 100) {
      return rejectInvalidInput('size', '1 이상 100 이하의 정수여야 합니다.');
    }
    const items = listNotificationsOf(auth.member.email);
    const body: NotificationPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
  http.get(mockUrl('/notifications/unread-count'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const body: UnreadNotificationCount = {
      count: listNotificationsOf(auth.member.email).filter((item) => item.readAt === null).length,
    };
    return HttpResponse.json(body);
  }),
  http.post(mockUrl('/notifications/read-all'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    markRead(auth.member.email, () => true);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(mockUrl('/notifications/:id/read'), ({ params }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) return rejectInvalidInput('id', '1 이상의 정수여야 합니다.');
    if (!listNotificationsOf(auth.member.email).some((item) => item.id === id)) {
      return HttpResponse.json(
        { code: NotificationNotFoundErrorCode.NOTIFICATION_NOT_FOUND, message: '알림을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    markRead(auth.member.email, (item) => item.id === id);
    const read = listNotificationsOf(auth.member.email).find((item) => item.id === id);
    return HttpResponse.json(read);
  }),
];
