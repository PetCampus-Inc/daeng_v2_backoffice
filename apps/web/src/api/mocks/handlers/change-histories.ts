import { http } from 'msw';
import type { HistoryActor, HistoryPerson, HistoryRecord, HistoryTargetType } from '@/routes/history/type/history';
import { HISTORY_TARGET_TYPES } from '@/routes/history/type/history';
import { errorResponse, mockUrl, okResponse, pageResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';
import { authenticateMockRequest } from '../util/session';

const ADMIN: HistoryPerson = { displayName: '김관리', jobRole: 'PM', email: 'admin@knockdog.test' };
const OPS: HistoryPerson = { displayName: '김운영', jobRole: 'PM', email: 'ops@knockdog.test' };
const OPS2: HistoryPerson = { displayName: '이담당', jobRole: 'FE', email: 'ops2@knockdog.test' };

/**
 * TC fixtures.md `이력-기본`. 개발자 도구에서 `daeng-bo-mock-change-histories`에 배열을 넣어
 * 빈 목록(`[]`)·`이력-25건` 같은 경우도 확인한다.
 */
const DEFAULT_HISTORIES: HistoryRecord[] = [
  {
    id: 1,
    occurredAt: '2026-10-01T09:00:00+09:00',
    actor: ADMIN,
    target: { type: 'terms', termsType: 'service', version: 3 },
    action: 'registerVersion',
    change: null,
  },
  {
    id: 2,
    occurredAt: '2026-10-01T09:00:00+09:00',
    actor: ADMIN,
    target: { type: 'terms', termsType: 'service', version: 3 },
    action: 'publishVersion',
    change: null,
  },
  {
    id: 3,
    occurredAt: '2026-10-01T10:00:00+09:00',
    actor: OPS,
    target: { type: 'notice', noticeId: 12, title: '10월 점검 안내' },
    action: 'create',
    change: null,
  },
  {
    id: 4,
    occurredAt: '2026-10-01T10:00:00+09:00',
    actor: OPS,
    target: { type: 'notice', noticeId: 12, title: '10월 점검 안내' },
    action: 'publish',
    change: null,
  },
  {
    id: 5,
    occurredAt: '2026-10-02T11:00:00+09:00',
    actor: ADMIN,
    target: { type: 'teamMember', email: 'ops2@knockdog.test' },
    action: 'changeRole',
    change: { kind: 'role', before: 'viewer', after: 'operator' },
  },
  {
    id: 6,
    occurredAt: '2026-10-03T15:00:00+09:00',
    // 표시명을 바꾸기 전 값이다. 지금 표시명은 '김운영'.
    actor: { ...OPS, displayName: '운영킴' },
    target: { type: 'notice', noticeId: 12, title: '10월 서비스 점검 안내' },
    action: 'update',
    change: null,
  },
  {
    id: 7,
    // KST로는 10월 4일 00:30이다. KST 날짜 경계 확인용.
    occurredAt: '2026-10-03T15:30:00Z',
    actor: OPS2,
    target: { type: 'inquiry', inquiryId: 1045 },
    action: 'assign',
    change: null,
  },
  {
    id: 8,
    occurredAt: '2026-10-05T10:00:00+09:00',
    actor: OPS,
    target: { type: 'inquiry', inquiryId: 1043 },
    action: 'changeAssignee',
    change: {
      kind: 'assignee',
      before: { displayName: '이담당', jobRole: 'FE' },
      after: { displayName: '김운영', jobRole: 'PM' },
    },
  },
  {
    id: 9,
    occurredAt: '2026-10-05T11:00:00+09:00',
    actor: OPS,
    target: { type: 'inquiry', inquiryId: 1044 },
    action: 'saveReply',
    change: null,
  },
  {
    id: 10,
    occurredAt: '2026-10-06T16:00:00+09:00',
    actor: ADMIN,
    target: { type: 'teamMember', email: 'canceled@knockdog.test' },
    action: 'cancelRegistration',
    change: null,
  },
];

const getMockHistories = (): HistoryRecord[] => {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-change-histories') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return DEFAULT_HISTORIES;
};

/** 서버 시각을 KST 날짜 `YYYY-MM-DD`로 바꾼다. 기간 판정은 KST 날짜 기준이다(PRD 7.12). */
const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 변경 이력은 최고 관리자만 조회한다(PRD 4.1). 비활성 계정은 거부한다. */
const authorize = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return auth.denied;
  const { member } = auth;
  if (member.role !== 'superAdmin') {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: '접근 권한이 없습니다.',
      errorMessage: '접근 권한이 없습니다.',
    });
  }
  return null;
};

export const CHANGE_HISTORY_HANDLERS = [
  http.get(mockUrl('/change-histories'), ({ request }) => {
    const denied = authorize();
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const actorEmail = params.get('actorEmail');
    const targetType = params.get('targetType') as HistoryTargetType | null;
    if (targetType && !HISTORY_TARGET_TYPES.includes(targetType)) {
      return errorResponse(400, {
        code: 'BAD_REQUEST',
        message: '잘못된 요청입니다.',
        errorMessage: '잘못된 요청입니다.',
      });
    }
    const items = getMockHistories()
      .filter((record) => {
        const date = KST_DATE_FORMAT.format(new Date(record.occurredAt));
        return (
          (!from || date >= from) &&
          (!to || date <= to) &&
          (!actorEmail || record.actor.email === actorEmail) &&
          (!targetType || record.target.type === targetType)
        );
      })
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.id - left.id);
    const rawPage = Number(params.get('page') ?? 0);
    const rawSize = Number(params.get('size') ?? 20);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isSafeInteger(rawSize) && rawSize > 0 && rawSize <= 100 ? rawSize : 20;
    return pageResponse(items, page, size);
  }),
  http.get(mockUrl('/change-histories/actors'), () => {
    const denied = authorize();
    if (denied) return denied;
    // 기록에 있는 계정만 고른다. 이름은 지금 프로필 값을 쓰고, 프로필이 없으면 마지막 기록 당시 값을 쓴다.
    const members = getMockTeamMembers();
    const actors = new Map<string, HistoryActor>();
    getMockHistories()
      .toSorted((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
      .forEach(({ actor }) => {
        const member = members.find((item) => item.email === actor.email);
        actors.set(actor.email, {
          email: actor.email,
          displayName: member?.displayName ?? actor.displayName,
          jobRole: member?.jobRole ?? actor.jobRole,
        });
      });
    return okResponse(
      [...actors.values()].toSorted((left, right) => left.displayName.localeCompare(right.displayName, 'ko'))
    );
  }),
];
