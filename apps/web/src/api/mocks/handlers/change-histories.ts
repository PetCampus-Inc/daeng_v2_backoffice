import { http, HttpResponse } from 'msw';
import type { ChangeLog, ChangeLogActor, ChangeLogPage } from '@/routes/history/type';
import { ChangeLogAction, ChangeLogTargetType } from '@/routes/history/type';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { getChangeLogList } from '../util/change-log-list';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

const ADMIN: ChangeLogActor = { id: 1, displayName: '김관리', jobRole: 'PM', email: 'admin@knockdog.test' };
const OPS: ChangeLogActor = { id: 2, displayName: '김운영', jobRole: 'PM', email: 'ops@knockdog.test' };
const OPS2: ChangeLogActor = { id: 3, displayName: '이담당', jobRole: 'FE', email: 'ops2@knockdog.test' };

const SERVICE_TERMS_LABEL = '서비스 이용약관 (시행 2026-10-20)';

/**
 * TC fixtures.md `이력-기본`. 서버 응답 모양 그대로 둔다. 개발자 도구에서 `daeng-bo-mock-change-logs`에 배열을 넣어
 * 빈 목록(`[]`)·`이력-25건` 같은 경우도 확인한다.
 */
const DEFAULT_CHANGE_LOGS: ChangeLog[] = [
  {
    id: 1,
    occurredAt: '2026-10-01T09:00:00+09:00',
    actor: ADMIN,
    targetType: ChangeLogTargetType.TERMS_VERSION,
    target: { id: 3, label: SERVICE_TERMS_LABEL },
    action: ChangeLogAction.TERMS_VERSION_CREATED,
    change: null,
  },
  {
    id: 2,
    occurredAt: '2026-10-01T09:00:00+09:00',
    actor: ADMIN,
    targetType: ChangeLogTargetType.TERMS_VERSION,
    target: { id: 3, label: SERVICE_TERMS_LABEL },
    action: ChangeLogAction.TERMS_VERSION_PUBLISHED,
    change: null,
  },
  {
    id: 3,
    occurredAt: '2026-10-01T10:00:00+09:00',
    actor: OPS,
    targetType: ChangeLogTargetType.NOTICE,
    target: { id: 12, label: '10월 점검 안내' },
    action: ChangeLogAction.NOTICE_CREATED,
    change: null,
  },
  {
    id: 4,
    occurredAt: '2026-10-01T10:00:00+09:00',
    actor: OPS,
    targetType: ChangeLogTargetType.NOTICE,
    target: { id: 12, label: '10월 점검 안내' },
    action: ChangeLogAction.NOTICE_UNPUBLISHED,
    change: null,
  },
  {
    id: 5,
    occurredAt: '2026-10-02T11:00:00+09:00',
    actor: ADMIN,
    targetType: ChangeLogTargetType.ACCOUNT,
    target: { id: 3, label: 'ops2@knockdog.test' },
    action: ChangeLogAction.ACCOUNT_ROLE_CHANGED,
    change: { from: 'VIEWER', to: 'OPERATOR' },
  },
  {
    id: 6,
    occurredAt: '2026-10-03T15:00:00+09:00',
    // 표시명을 바꾸기 전 값이다. 지금 표시명은 '김운영'.
    actor: { ...OPS, displayName: '운영킴' },
    targetType: ChangeLogTargetType.NOTICE,
    target: { id: 12, label: '10월 서비스 점검 안내' },
    action: ChangeLogAction.NOTICE_EDITED,
    change: null,
  },
  {
    id: 7,
    // KST로는 10월 4일 00:30이다. KST 날짜 경계 확인용.
    occurredAt: '2026-10-03T15:30:00Z',
    actor: OPS2,
    targetType: ChangeLogTargetType.INQUIRY,
    target: { id: 1045, label: '문의 #1045' },
    action: ChangeLogAction.INQUIRY_ASSIGNED,
    change: { from: null, to: '이담당' },
  },
  {
    id: 8,
    occurredAt: '2026-10-05T10:00:00+09:00',
    actor: OPS,
    targetType: ChangeLogTargetType.INQUIRY,
    target: { id: 1043, label: '문의 #1043' },
    action: ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
    change: { from: '이담당', to: '김운영' },
  },
  {
    id: 9,
    occurredAt: '2026-10-05T11:00:00+09:00',
    actor: OPS,
    targetType: ChangeLogTargetType.INQUIRY,
    target: { id: 1044, label: '문의 #1044' },
    action: ChangeLogAction.INQUIRY_REPLIED,
    change: null,
  },
  {
    id: 10,
    occurredAt: '2026-10-06T16:00:00+09:00',
    actor: ADMIN,
    targetType: ChangeLogTargetType.ACCOUNT,
    target: { id: 7, label: 'canceled@knockdog.test' },
    action: ChangeLogAction.ACCOUNT_REGISTRATION_CANCELLED,
    change: null,
  },
];

const getMockChangeLogs = (): ChangeLog[] => {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-change-logs') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return DEFAULT_CHANGE_LOGS;
};

/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

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

/** 변경 이력은 최고 관리자만 조회한다(PRD 4.1). 세션이 없거나 만료·비활성이면 401, 다른 역할이면 403으로 거부한다. */
const authorize = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return auth.denied;
  if (auth.member.role !== 'SUPER_ADMIN') {
    return HttpResponse.json(
      { code: ForbiddenErrorCode.FORBIDDEN, message: '이 기능을 사용할 권한이 없습니다.' },
      { status: 403 }
    );
  }
  return null;
};

/**
 * 변경 이력 가짜 API(`GET /change-logs`). 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다.
 * 서버처럼 시작일이 종료일보다 늦은 기간, 1 이상의 정수가 아닌 `page`(안전 정수 범위 밖 포함),
 * 1~100이 아닌 `size`, 모르는 대상 종류, 정수가 아닌 `actorId`는 400으로 돌려준다.
 */
export const CHANGE_HISTORY_HANDLERS = [
  http.get(mockUrl('/change-logs'), ({ request }) => {
    const denied = authorize();
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const from = params.get('from') ?? undefined;
    const to = params.get('to') ?? undefined;
    if (from && to && from > to) return rejectInvalidInput('from', '시작일은 종료일보다 늦을 수 없습니다.');
    const rawTargetType = params.get('targetType');
    const targetType = Object.values(ChangeLogTargetType).find((value) => value === rawTargetType);
    if (rawTargetType && !targetType) return rejectInvalidInput('targetType', '올바른 대상 종류가 아닙니다.');
    const rawActorId = params.get('actorId');
    const actorId = rawActorId === null ? undefined : Number(rawActorId);
    if (actorId !== undefined && !Number.isSafeInteger(actorId)) {
      return rejectInvalidInput('actorId', '올바른 팀원 ID가 아닙니다.');
    }
    const page = Number(params.get('page') ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return rejectInvalidInput('page', '1 이상의 정수여야 합니다.');
    const size = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    if (!Number.isSafeInteger(size) || size < 1 || size > 100) {
      return rejectInvalidInput('size', '1 이상 100 이하의 정수여야 합니다.');
    }
    const items = getChangeLogList(getMockChangeLogs(), { from, to, actorId, targetType });
    const body: ChangeLogPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
];
