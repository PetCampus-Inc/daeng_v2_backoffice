import { http, HttpResponse } from 'msw';
import { mockUrl, okResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import { getMockTeamMembers } from './team-members';
import { recordMockNotification } from '../util/notification-event';
import { getInquiryAssigneeLog, type InquiryChangeLogMember } from '../util/inquiry-change-log';
import { recordMockChangeLog } from './change-histories';
import {
  getAdjacentInquiryIds,
  getInquiryList,
  parseInquiryId,
  parseInquiryListQuery,
  type MockInquiry,
  type MockInquiryQueryIssue,
} from '../util/inquiry-list';
import {
  InquiryConflictErrorCode,
  InquiryMessageAuthor,
  InquiryNotFoundErrorCode,
  InquiryReplyInvalidErrorCode,
  InquiryStatus,
  type InquiryAssignee,
  type InquiryDetail,
  type InquiryImage,
  type InquiryMessage,
  type InquirySummary,
  type InquirySummaryPage,
} from '@/routes/inquiries/type';
import { INQUIRY_STATUS_FROM_SERVER, INQUIRY_STATUS_REQUEST_VALUES } from '@/routes/inquiries/type/inquiry-ui';
import { ChangeLogTargetType } from '@/routes/history/type';
import { checkAssignRequest, transitionInquiry, type InquiryEvent } from '@/routes/inquiries/util/inquiry-policy';
import { canSubmitReply } from '@/routes/inquiries/util/reply-input';
import type { TeamMember } from '@/routes/settings/members/type/team-member';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import { JOB_ROLE_LABELS } from '@/type/job-role-ui';
import type { InquiryUser } from '@/type/inquiry-user';
import { UserType } from '@/type/user-type';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';

// 담당자를 이메일 대신 팀원 번호로 저장하고 상태·유형 값이 서버 표기(대문자)로 바뀌어 저장 키를 바꿨다.
// 이전 키(`daeng-bo-mock-inquiries-v2`)의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-inquiries-v3';

// fixtures.md `문의-기본`의 담당자(팀원 번호): 김운영 · PM(운영자), 이담당 · FE(운영자2), 정비활 · BE(비활성팀원)
const OPERATOR_ID = 2;
const OTHER_MEMBER_ID = 3;
const INACTIVE_MEMBER_ID = 5;

const HONG: InquiryUser = { type: UserType.GUARDIAN, name: '홍길동', email: 'hong@example.com' };
const LEE: InquiryUser = { type: UserType.DIRECTOR, name: '이원장', email: 'Director.Lee@example.com' };
const CHOI: InquiryUser = { type: UserType.GUARDIAN, name: '최보호', email: 'choi@example.com' };

/** 썸네일 자리에 쓸 가짜 이미지(SVG 데이터 주소). */
const createMockImageUrl = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="144"><rect width="192" height="144" fill="${color}"/><text x="96" y="80" font-size="24" text-anchor="middle" fill="#15161b">${label}</text></svg>`
  )}`;

const INQUIRY_1041_IMAGES: InquiryImage[] = [
  { id: '1041-1', url: createMockImageUrl('JPG 1', '#fff7ec'), fileName: 'IMG_0001.jpg' },
  { id: '1041-2', url: createMockImageUrl('JPG 2', '#eef5ff'), fileName: 'IMG_0002.jpg' },
  { id: '1041-3', url: createMockImageUrl('JPG 3', '#ecf8f0'), fileName: 'IMG_0003.jpg' },
  { id: '1041-4', url: createMockImageUrl('PNG', '#fff7e6'), fileName: 'screenshot.png' },
  { id: '1041-5', url: createMockImageUrl('HEIC → JPG', '#f3f3f7'), fileName: 'IMG_0005.heic' },
];

/** 가짜 메시지 하나. 이미지가 없으면 빈 배열이다. */
const createMessage = (
  id: string,
  author: InquiryMessage['author'],
  authorName: string,
  body: string,
  createdAt: string,
  images: InquiryImage[] = []
): InquiryMessage => ({ id, author, authorName, body, createdAt, images });

/** fixtures.md `문의-기본` 10건. 시각은 KST로 적는다. */
export const createDefaultInquiries = (): MockInquiry[] => [
  {
    id: 1041,
    status: InquiryStatus.WAITING,
    title: '산책 예약이 안 돼요',
    user: HONG,
    assigneeId: null,
    createdAt: '2026-10-07T09:30:00+09:00',
    lastActivityAt: '2026-10-07T09:30:00+09:00',
    messages: [
      createMessage(
        '1041-1',
        InquiryMessageAuthor.USER,
        '홍길동',
        '예약 버튼을 눌러도 반응이 없어요',
        '2026-10-07T09:30:00+09:00',
        [...INQUIRY_1041_IMAGES]
      ),
    ],
  },
  {
    id: 1042,
    status: InquiryStatus.WAITING,
    title: '정산 문의',
    user: LEE,
    assigneeId: null,
    createdAt: '2026-10-07T09:00:00+09:00',
    lastActivityAt: '2026-10-07T09:00:00+09:00',
    messages: [
      createMessage(
        '1042-1',
        InquiryMessageAuthor.USER,
        '이원장',
        '이번 달 정산 금액이 달라요',
        '2026-10-07T09:00:00+09:00'
      ),
    ],
  },
  {
    id: 1043,
    status: InquiryStatus.CHECKING,
    title: '알림이 안 와요',
    user: CHOI,
    assigneeId: OPERATOR_ID,
    createdAt: '2026-10-06T18:00:00+09:00',
    lastActivityAt: '2026-10-06T18:00:00+09:00',
    messages: [
      createMessage(
        '1043-1',
        InquiryMessageAuthor.USER,
        '최보호',
        '푸시 알림이 오지 않습니다',
        '2026-10-06T18:00:00+09:00'
      ),
    ],
  },
  {
    id: 1044,
    status: InquiryStatus.ANSWERED,
    title: '결제 영수증',
    user: HONG,
    assigneeId: OPERATOR_ID,
    createdAt: '2026-10-06T10:00:00+09:00',
    lastActivityAt: '2026-10-06T18:00:00+09:00',
    messages: [
      createMessage(
        '1044-1',
        InquiryMessageAuthor.USER,
        '홍길동',
        '결제 영수증을 받고 싶어요',
        '2026-10-06T10:00:00+09:00'
      ),
      createMessage(
        '1044-2',
        InquiryMessageAuthor.OPERATOR,
        '김운영',
        '영수증은 메일로 보내 드렸습니다',
        '2026-10-06T18:00:00+09:00'
      ),
    ],
  },
  {
    id: 1045,
    status: InquiryStatus.CHECKING,
    title: '원생 등록 오류',
    user: LEE,
    assigneeId: OTHER_MEMBER_ID,
    createdAt: '2026-10-06T12:00:00+09:00',
    lastActivityAt: '2026-10-06T12:00:00+09:00',
    messages: [
      createMessage(
        '1045-1',
        InquiryMessageAuthor.USER,
        '이원장',
        '원생을 등록하면 오류가 나요',
        '2026-10-06T12:00:00+09:00'
      ),
    ],
  },
  {
    id: 1050,
    status: InquiryStatus.WAITING,
    title: '사진 업로드',
    user: LEE,
    assigneeId: OPERATOR_ID,
    createdAt: '2026-10-05T09:00:00+09:00',
    lastActivityAt: '2026-10-05T20:00:00+09:00',
    messages: [
      createMessage(
        '1050-1',
        InquiryMessageAuthor.USER,
        '이원장',
        '사진이 올라가지 않아요',
        '2026-10-05T09:00:00+09:00'
      ),
      createMessage(
        '1050-2',
        InquiryMessageAuthor.OPERATOR,
        '김운영',
        '앱을 다시 실행해 주세요',
        '2026-10-05T12:00:00+09:00'
      ),
      createMessage(
        '1050-3',
        InquiryMessageAuthor.USER,
        '이원장',
        '추가로 궁금한 게 있어요',
        '2026-10-05T20:00:00+09:00'
      ),
    ],
  },
  {
    id: 1046,
    status: InquiryStatus.ANSWERED,
    title: '회원 탈퇴 방법',
    user: CHOI,
    assigneeId: null,
    createdAt: '2026-10-05T11:00:00+09:00',
    lastActivityAt: '2026-10-05T15:00:00+09:00',
    messages: [
      createMessage('1046-1', InquiryMessageAuthor.USER, '최보호', '탈퇴는 어떻게 하나요', '2026-10-05T11:00:00+09:00'),
      createMessage(
        '1046-2',
        InquiryMessageAuthor.OPERATOR,
        '이담당',
        '설정 화면에서 할 수 있습니다',
        '2026-10-05T15:00:00+09:00'
      ),
    ],
  },
  {
    id: 1047,
    status: InquiryStatus.CHECKING,
    title: '쿠폰 적용',
    user: HONG,
    assigneeId: INACTIVE_MEMBER_ID,
    createdAt: '2026-10-05T10:00:00+09:00',
    lastActivityAt: '2026-10-05T10:00:00+09:00',
    messages: [
      createMessage(
        '1047-1',
        InquiryMessageAuthor.USER,
        '홍길동',
        '쿠폰이 적용되지 않아요',
        '2026-10-05T10:00:00+09:00'
      ),
    ],
  },
  {
    id: 1048,
    status: InquiryStatus.RESOLVED,
    title: '비밀번호 변경',
    user: CHOI,
    assigneeId: OPERATOR_ID,
    createdAt: '2026-10-04T09:00:00+09:00',
    lastActivityAt: '2026-10-04T12:00:00+09:00',
    messages: [
      createMessage(
        '1048-1',
        InquiryMessageAuthor.USER,
        '최보호',
        '비밀번호를 바꾸고 싶어요',
        '2026-10-04T09:00:00+09:00'
      ),
      createMessage(
        '1048-2',
        InquiryMessageAuthor.OPERATOR,
        '김운영',
        '설정 메뉴에서 바꿀 수 있습니다',
        '2026-10-04T12:00:00+09:00'
      ),
    ],
  },
  {
    id: 1049,
    status: InquiryStatus.RESOLVED,
    title: '앱 오류',
    user: LEE,
    assigneeId: null,
    createdAt: '2026-10-03T09:00:00+09:00',
    lastActivityAt: '2026-10-03T12:00:00+09:00',
    messages: [
      createMessage('1049-1', InquiryMessageAuthor.USER, '이원장', '앱이 자꾸 꺼져요', '2026-10-03T09:00:00+09:00'),
      createMessage(
        '1049-2',
        InquiryMessageAuthor.OPERATOR,
        '김관리',
        '최신 버전으로 업데이트해 주세요',
        '2026-10-03T12:00:00+09:00'
      ),
    ],
  },
];

/** 개발용 문의는 새로고침 뒤에도 유지한다. 지우면 `문의-기본`으로 돌아간다. */
const getMockInquiries = (): MockInquiry[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return createDefaultInquiries();
};

/** 바꾼 문의 목록을 저장한다. */
const saveMockInquiries = (inquiries: MockInquiry[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(inquiries));

/** 표시명과 직무가 있는 팀원만 담당자로 보여 줄 수 있다. 없으면 서버처럼 담당자 없음(`null`)으로 내려준다. */
const toAssignee = (member: TeamMember | undefined): InquiryAssignee | null =>
  member?.displayName && member.jobRole
    ? {
        id: member.id,
        email: member.email,
        displayName: member.displayName,
        jobRole: member.jobRole,
        isActive: member.status === 'ACTIVE',
      }
    : null;

/** 서버는 시각을 UTC(`Z`)로 준다. 저장해 둔 KST 표기도 같은 모양으로 바꿔 응답한다. */
const toUtcIso = (value: string) => new Date(value).toISOString();

/** 저장한 문의를 목록 한 행 응답으로 바꾼다. */
const toInquirySummary = (inquiry: MockInquiry, members: TeamMember[]): InquirySummary => ({
  id: inquiry.id,
  status: inquiry.status,
  title: inquiry.title,
  user: inquiry.user,
  assignee: toAssignee(members.find((member) => member.id === inquiry.assigneeId)),
  lastActivityAt: toUtcIso(inquiry.lastActivityAt),
});

/** 저장한 문의를 상세 응답으로 바꾼다. */
const toInquiryDetail = (inquiry: MockInquiry, members: TeamMember[]): InquiryDetail => ({
  ...toInquirySummary(inquiry, members),
  createdAt: toUtcIso(inquiry.createdAt),
  messages: inquiry.messages.map((message) => ({ ...message, createdAt: toUtcIso(message.createdAt) })),
});

/** 서버 오류와 같은 모양(`{ code, message }`)으로 요청 거부 사유를 전달한다. */
const rejectInquiryRequest = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** 입력 검증 실패 응답(400). 서버처럼 어느 값이 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (issues: MockInquiryQueryIssue[]) =>
  HttpResponse.json(
    { code: ValidationFailedErrorCode.VALIDATION_FAILED, message: '입력값을 확인해 주세요.', details: issues },
    { status: 400 }
  );

const invalidIdResponse = () => rejectInvalidInput([{ field: 'id', reason: '1 이상의 정수여야 합니다.' }]);
const notFoundResponse = () =>
  rejectInquiryRequest(404, InquiryNotFoundErrorCode.INQUIRY_NOT_FOUND, '문의를 찾을 수 없습니다.');
const resolvedResponse = () =>
  rejectInquiryRequest(
    409,
    InquiryConflictErrorCode.INQUIRY_RESOLVED,
    '해결 완료된 문의라 답변과 담당 변경을 할 수 없습니다.'
  );
const assigneeChangedResponse = () =>
  rejectInquiryRequest(409, InquiryConflictErrorCode.INQUIRY_ASSIGNEE_CHANGED, '담당자가 변경되었습니다.');

/** 모든 문의 API에서 세션(만료·비활성 포함)과 최고 관리자·운영자 역할을 검사한다(PRD 4.1, 4.5). */
const authorizeInquiryRequest = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return { denied: auth.denied };
  const { member } = auth;
  if (member.role === 'VIEWER') {
    return { denied: rejectInquiryRequest(403, ForbiddenErrorCode.FORBIDDEN, '접근 권한이 없습니다.') };
  }
  return { member };
};

/** 저장한 문의의 상태 전환 입력(화면 규칙은 소문자 상태를 쓴다). */
const toPolicyState = (inquiry: MockInquiry) => ({
  status: INQUIRY_STATUS_FROM_SERVER[inquiry.status],
  assigneeId: inquiry.assigneeId,
});

/** 상태 전환 결과를 저장 모양(서버 표기)으로 바꿔 문의에 적용한다. */
const applyPolicyState = (inquiry: MockInquiry, next: ReturnType<typeof toPolicyState>): MockInquiry => ({
  ...inquiry,
  status: INQUIRY_STATUS_REQUEST_VALUES[next.status],
  assigneeId: next.assigneeId,
});

/** 이름·직무가 모두 있는 팀원만 이력에 남길 수 있다. 없으면 `undefined`. */
const toChangeLogMember = (member: TeamMember | undefined): InquiryChangeLogMember | undefined =>
  member?.displayName && member.jobRole ? { displayName: member.displayName, jobRole: member.jobRole } : undefined;

/**
 * 담당자 지정·변경·해제·해제 실행 취소가 성공한 뒤 변경 이력을 남긴다(서버 `inquiries.service.ts`와 같은 규칙).
 * 행위자는 로그인한 팀원, 대상은 문의 번호다.
 */
const recordInquiryAssigneeLog = (
  event: 'assign' | 'release' | 'restore',
  inquiry: MockInquiry,
  member: TeamMember,
  members: TeamMember[]
) => {
  const actor = toChangeLogMember(member);
  if (!actor || !member.displayName || !member.jobRole) return;
  const log = getInquiryAssigneeLog({
    event,
    actorId: member.id,
    actor,
    previousAssigneeId: inquiry.assigneeId,
    previousMember: toChangeLogMember(members.find((item) => item.id === inquiry.assigneeId)),
  });
  if (!log) return;
  recordMockChangeLog({
    actor: { id: member.id, displayName: member.displayName, jobRole: member.jobRole, email: member.email },
    targetType: ChangeLogTargetType.INQUIRY,
    target: { id: inquiry.id, label: `문의 #${inquiry.id}` },
    ...log,
  });
};

/** 상태 전환을 적용해 저장하고 응답한다. 거부되면 최신 상태를 다시 읽도록 거부 사유를 준다. */
const applyInquiryEvent = (rawId: unknown, event: InquiryEvent) => {
  const { denied, member } = authorizeInquiryRequest();
  if (denied) return denied;
  const id = parseInquiryId(rawId);
  if (id === undefined) return invalidIdResponse();
  const inquiries = getMockInquiries();
  const index = inquiries.findIndex((item) => item.id === id);
  if (index < 0) return notFoundResponse();
  const inquiry = inquiries[index];
  const next = transitionInquiry(toPolicyState(inquiry), event, member.id);
  if (!next) return inquiry.status === InquiryStatus.RESOLVED ? resolvedResponse() : assigneeChangedResponse();
  inquiries[index] = applyPolicyState(inquiry, next);
  saveMockInquiries(inquiries);
  const members = getMockTeamMembers();
  if (event === 'release' || event === 'restore') recordInquiryAssigneeLog(event, inquiry, member, members);
  return HttpResponse.json(toInquiryDetail(inquiries[index], members));
};

/**
 * 문의 가짜 API. 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 서버처럼 100자를 넘는 검색어, 잘못된 담당자·번호는
 * 400으로, 없는 문의는 404로 돌려준다. 담당자는 팀원 번호로 가린다. 서버에 없는 이미지 원본 주소는 두지 않는다.
 */
export const INQUIRY_HANDLERS = [
  http.get(mockUrl('/inquiries'), ({ request }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const parsed = parseInquiryListQuery(new URL(request.url).searchParams, member.id, { hasPage: true });
    if (parsed.issues) return rejectInvalidInput(parsed.issues);
    const { filter, page, size } = parsed;
    const inquiries = getInquiryList(getMockInquiries(), filter);
    const members = getMockTeamMembers();
    const body: InquirySummaryPage = {
      items: inquiries.slice((page - 1) * size, page * size).map((inquiry) => toInquirySummary(inquiry, members)),
      page,
      size,
      totalItems: inquiries.length,
      totalPages: Math.ceil(inquiries.length / size),
    };
    return HttpResponse.json(body);
  }),
  http.get(mockUrl('/inquiries/assignees'), () => {
    const { denied } = authorizeInquiryRequest();
    if (denied) return denied;
    // 표시명이 없는 등록됨·등록 취소 팀원은 빠진다(R-담당자필터목록). 팀원 번호순이다.
    const assignees = getMockTeamMembers()
      .filter((member) => member.status === 'ACTIVE' || member.status === 'INACTIVE')
      .sort((left, right) => left.id - right.id)
      .map(toAssignee)
      .filter((assignee) => assignee !== null);
    return HttpResponse.json(assignees);
  }),
  http.get(mockUrl('/inquiries/:id'), ({ params }) => {
    const { denied } = authorizeInquiryRequest();
    if (denied) return denied;
    const id = parseInquiryId(params.id);
    if (id === undefined) return invalidIdResponse();
    const inquiry = getMockInquiries().find((item) => item.id === id);
    return inquiry ? HttpResponse.json(toInquiryDetail(inquiry, getMockTeamMembers())) : notFoundResponse();
  }),
  http.get(mockUrl('/inquiries/:id/adjacent'), ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const id = parseInquiryId(params.id);
    if (id === undefined) return invalidIdResponse();
    const parsed = parseInquiryListQuery(new URL(request.url).searchParams, member.id, { hasPage: false });
    if (parsed.issues) return rejectInvalidInput(parsed.issues);
    const inquiries = getMockInquiries();
    if (!inquiries.some((item) => item.id === id)) return notFoundResponse();
    // 지금 조건에 이 문의가 없으면(예: 미배정 필터에서 맡음) 앞뒤를 정할 수 없어 둘 다 비운다.
    return HttpResponse.json(getAdjacentInquiryIds(inquiries, id, parsed.filter));
  }),
  http.post(mockUrl('/inquiries/:id/assignee'), async ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const id = parseInquiryId(params.id);
    if (id === undefined) return invalidIdResponse();
    const body = (await request.json().catch(() => null)) as { expectedAssigneeId?: unknown } | null;
    const expectedAssigneeId = body?.expectedAssigneeId;
    if (
      expectedAssigneeId !== null &&
      (typeof expectedAssigneeId !== 'number' || !parseInquiryId(String(expectedAssigneeId)))
    ) {
      return rejectInvalidInput([{ field: 'expectedAssigneeId', reason: '팀원 번호 또는 null이어야 합니다.' }]);
    }
    const inquiries = getMockInquiries();
    const index = inquiries.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const check = checkAssignRequest(toPolicyState(inquiry), expectedAssigneeId);
    if (check === 'resolved') return resolvedResponse();
    if (check === 'conflict') return assigneeChangedResponse();
    const next = transitionInquiry(toPolicyState(inquiry), 'assign', member.id);
    if (!next) return resolvedResponse();
    inquiries[index] = applyPolicyState(inquiry, next);
    saveMockInquiries(inquiries);
    const members = getMockTeamMembers();
    const previousAssignee = members.find((item) => item.id === inquiry.assigneeId);
    recordInquiryAssigneeLog('assign', inquiry, member, members);
    // 이전 담당자가 활성 팀원일 때만 알린다(S-문의-034).
    if (previousAssignee && previousAssignee.id !== member.id && previousAssignee.status === 'ACTIVE') {
      recordMockNotification(members, {
        type: 'assigneeChanged',
        targetId: inquiry.id,
        previousEmail: previousAssignee.email,
        actorName: [member.displayName, member.jobRole && JOB_ROLE_LABELS[member.jobRole]].filter(Boolean).join(' · '),
      });
    }
    return HttpResponse.json(toInquiryDetail(inquiries[index], members));
  }),
  http.delete(mockUrl('/inquiries/:id/assignee'), ({ params }) => applyInquiryEvent(params.id, 'release')),
  http.post(mockUrl('/inquiries/:id/assignee/restore'), ({ params }) => applyInquiryEvent(params.id, 'restore')),
  http.post(mockUrl('/inquiries/:id/replies'), async ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const id = parseInquiryId(params.id);
    if (id === undefined) return invalidIdResponse();
    const body = ((await request.json().catch(() => null)) as { body?: unknown } | null)?.body;
    if (typeof body !== 'string' || !canSubmitReply(body, false)) {
      return rejectInquiryRequest(
        400,
        InquiryReplyInvalidErrorCode.INQUIRY_REPLY_INVALID,
        '답변은 1자 이상 500자 이하로 입력해 주세요.'
      );
    }
    const inquiries = getMockInquiries();
    const index = inquiries.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const next = transitionInquiry(toPolicyState(inquiry), 'reply', member.id);
    if (!next) return inquiry.status === InquiryStatus.RESOLVED ? resolvedResponse() : assigneeChangedResponse();
    const createdAt = new Date().toISOString();
    // 답변을 저장하면 최근 활동이 그 시각으로 바뀐다(R-최근활동-03). 사용자 앱 알림 발송은 실제 서버가 한다.
    inquiries[index] = {
      ...applyPolicyState(inquiry, next),
      lastActivityAt: createdAt,
      messages: [
        ...inquiry.messages,
        createMessage(
          `${inquiry.id}-${Date.now()}`,
          InquiryMessageAuthor.OPERATOR,
          member.displayName ?? '운영자',
          body,
          createdAt
        ),
      ],
    };
    saveMockInquiries(inquiries);
    return HttpResponse.json(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
  // 아래 주소들은 앱 사용자 동작을 흉내 내는 개발용이다. 화면에서는 부르지 않고, 개발자 도구에서 fetch로 부른다.
  http.post(mockUrl('/dev/inquiries'), async ({ request }) => {
    const input = (await request.json()) as { title: string; body: string };
    const inquiries = getMockInquiries();
    const id = Math.max(1050, ...inquiries.map((item) => item.id)) + 1;
    const createdAt = new Date().toISOString();
    const inquiry: MockInquiry = {
      id,
      status: InquiryStatus.WAITING,
      title: input.title,
      user: HONG,
      assigneeId: null,
      createdAt,
      lastActivityAt: createdAt,
      messages: [createMessage(`${id}-1`, InquiryMessageAuthor.USER, HONG.name, input.body, createdAt)],
    };
    saveMockInquiries([...inquiries, inquiry]);
    recordMockNotification(getMockTeamMembers(), { type: 'newInquiry', targetId: id });
    return okResponse(toInquiryDetail(inquiry, getMockTeamMembers()), 201);
  }),
  http.post(mockUrl('/dev/inquiries/:id/user-messages'), async ({ params, request }) => {
    const { body } = (await request.json()) as { body: string };
    const inquiries = getMockInquiries();
    const index = inquiries.findIndex((item) => String(item.id) === params.id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const next = transitionInquiry(toPolicyState(inquiry), 'userFollowUp', 0);
    if (!next) return resolvedResponse();
    const createdAt = new Date().toISOString();
    inquiries[index] = {
      ...applyPolicyState(inquiry, next),
      lastActivityAt: createdAt,
      messages: [
        ...inquiry.messages,
        createMessage(`${inquiry.id}-${Date.now()}`, InquiryMessageAuthor.USER, inquiry.user.name, body, createdAt),
      ],
    };
    saveMockInquiries(inquiries);
    const members = getMockTeamMembers();
    const assignee = members.find((item) => item.id === inquiry.assigneeId);
    recordMockNotification(members, { type: 'followUp', targetId: inquiry.id, assigneeEmail: assignee?.email ?? null });
    return okResponse(toInquiryDetail(inquiries[index], members));
  }),
  http.post(mockUrl('/dev/inquiries/:id/close'), ({ params }) => {
    const inquiries = getMockInquiries();
    const index = inquiries.findIndex((item) => String(item.id) === params.id);
    if (index < 0) return notFoundResponse();
    const next = transitionInquiry(toPolicyState(inquiries[index]), 'userClose', 0);
    if (!next) return rejectInquiryRequest(409, 'INQUIRY_CLOSE_REJECTED', '답변 도착 문의만 종료할 수 있습니다.');
    inquiries[index] = applyPolicyState(inquiries[index], next);
    saveMockInquiries(inquiries);
    return okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
];
