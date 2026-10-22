import { http } from 'msw';
import { errorResponse, mockUrl, okResponse, pageResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import { getMockTeamMembers } from './team-members';
import {
  INQUIRY_ERROR_CODES,
  type InquiryAssignee,
  type InquiryDetail,
  type InquiryImage,
  type InquiryMessage,
  type InquiryStatus,
  type InquiryUser,
} from '@/routes/inquiries/type/inquiry';
import { checkAssignRequest, transitionInquiry, type InquiryEvent } from '@/routes/inquiries/util/inquiry-policy';
import { canSubmitReply } from '@/routes/inquiries/util/reply-input';
import type { TeamMember } from '@/routes/settings/members/type/team-member';

// fixtures에 맞춰 담당자 이메일을 바꿔 저장 키를 바꿨다. 이전 키(`daeng-bo-mock-inquiries`)의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-inquiries-v2';
const NOTIFICATION_STORAGE_KEY = 'daeng-bo-mock-notifications';

/** 가짜 서버에 저장하는 문의. 담당자는 이메일로 두고 응답할 때 팀원 정보로 바꾼다. */
type MockInquiry = {
  id: number;
  status: InquiryStatus;
  title: string;
  user: InquiryUser;
  assigneeEmail: string | null;
  createdAt: string;
  lastActivityAt: string;
  messages: InquiryMessage[];
};

/** 가짜 서버가 남기는 BO 알림. 알림 센터(7.14)를 만들면 이 기록을 읽는다. */
type MockNotification = { recipientEmail: string; message: string; inquiryId: number; createdAt: string };

// fixtures.md `문의-기본`의 담당자: 김운영 · PM(운영자), 이담당 · FE(운영자2), 정비활 · BE(비활성팀원)
const OPERATOR_EMAIL = 'ops@knockdog.test';
const OTHER_MEMBER_EMAIL = 'ops2@knockdog.test';
const INACTIVE_MEMBER_EMAIL = 'inactive@knockdog.test';

const HONG: InquiryUser = { type: 'guardian', name: '홍길동', email: 'hong@example.com' };
const LEE: InquiryUser = { type: 'director', name: '이원장', email: 'Director.Lee@example.com' };
const CHOI: InquiryUser = { type: 'guardian', name: '최보호', email: 'choi@example.com' };

/** 썸네일 자리에 쓸 가짜 이미지(SVG 데이터 주소). */
const createMockImageUrl = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="144"><rect width="192" height="144" fill="${color}"/><text x="96" y="80" font-size="24" text-anchor="middle" fill="#15161b">${label}</text></svg>`
  )}`;

const INQUIRY_1041_IMAGES: InquiryImage[] = [
  { id: '1041-1', url: createMockImageUrl('JPG 1', '#fff7ec'), originalUrl: null, fileName: 'IMG_0001.jpg' },
  { id: '1041-2', url: createMockImageUrl('JPG 2', '#eef5ff'), originalUrl: null, fileName: 'IMG_0002.jpg' },
  { id: '1041-3', url: createMockImageUrl('JPG 3', '#ecf8f0'), originalUrl: null, fileName: 'IMG_0003.jpg' },
  { id: '1041-4', url: createMockImageUrl('PNG', '#fff7e6'), originalUrl: null, fileName: 'screenshot.png' },
  {
    id: '1041-5',
    url: createMockImageUrl('HEIC → JPG', '#f3f3f7'),
    originalUrl: `data:image/heic;base64,${btoa('mock heic original')}`,
    fileName: 'IMG_0005.heic',
  },
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
const createDefaultInquiries = (): MockInquiry[] => [
  {
    id: 1041,
    status: 'waiting',
    title: '산책 예약이 안 돼요',
    user: HONG,
    assigneeEmail: null,
    createdAt: '2026-10-07T09:30:00+09:00',
    lastActivityAt: '2026-10-07T09:30:00+09:00',
    messages: [
      createMessage('1041-1', 'user', '홍길동', '예약 버튼을 눌러도 반응이 없어요', '2026-10-07T09:30:00+09:00', [
        ...INQUIRY_1041_IMAGES,
      ]),
    ],
  },
  {
    id: 1042,
    status: 'waiting',
    title: '정산 문의',
    user: LEE,
    assigneeEmail: null,
    createdAt: '2026-10-07T09:00:00+09:00',
    lastActivityAt: '2026-10-07T09:00:00+09:00',
    messages: [createMessage('1042-1', 'user', '이원장', '이번 달 정산 금액이 달라요', '2026-10-07T09:00:00+09:00')],
  },
  {
    id: 1043,
    status: 'checking',
    title: '알림이 안 와요',
    user: CHOI,
    assigneeEmail: OPERATOR_EMAIL,
    createdAt: '2026-10-06T18:00:00+09:00',
    lastActivityAt: '2026-10-06T18:00:00+09:00',
    messages: [createMessage('1043-1', 'user', '최보호', '푸시 알림이 오지 않습니다', '2026-10-06T18:00:00+09:00')],
  },
  {
    id: 1044,
    status: 'answered',
    title: '결제 영수증',
    user: HONG,
    assigneeEmail: OPERATOR_EMAIL,
    createdAt: '2026-10-06T10:00:00+09:00',
    lastActivityAt: '2026-10-06T18:00:00+09:00',
    messages: [
      createMessage('1044-1', 'user', '홍길동', '결제 영수증을 받고 싶어요', '2026-10-06T10:00:00+09:00'),
      createMessage('1044-2', 'operator', '김운영', '영수증은 메일로 보내 드렸습니다', '2026-10-06T18:00:00+09:00'),
    ],
  },
  {
    id: 1045,
    status: 'checking',
    title: '원생 등록 오류',
    user: LEE,
    assigneeEmail: OTHER_MEMBER_EMAIL,
    createdAt: '2026-10-06T12:00:00+09:00',
    lastActivityAt: '2026-10-06T12:00:00+09:00',
    messages: [createMessage('1045-1', 'user', '이원장', '원생을 등록하면 오류가 나요', '2026-10-06T12:00:00+09:00')],
  },
  {
    id: 1050,
    status: 'waiting',
    title: '사진 업로드',
    user: LEE,
    assigneeEmail: OPERATOR_EMAIL,
    createdAt: '2026-10-05T09:00:00+09:00',
    lastActivityAt: '2026-10-05T20:00:00+09:00',
    messages: [
      createMessage('1050-1', 'user', '이원장', '사진이 올라가지 않아요', '2026-10-05T09:00:00+09:00'),
      createMessage('1050-2', 'operator', '김운영', '앱을 다시 실행해 주세요', '2026-10-05T12:00:00+09:00'),
      createMessage('1050-3', 'user', '이원장', '추가로 궁금한 게 있어요', '2026-10-05T20:00:00+09:00'),
    ],
  },
  {
    id: 1046,
    status: 'answered',
    title: '회원 탈퇴 방법',
    user: CHOI,
    assigneeEmail: null,
    createdAt: '2026-10-05T11:00:00+09:00',
    lastActivityAt: '2026-10-05T15:00:00+09:00',
    messages: [
      createMessage('1046-1', 'user', '최보호', '탈퇴는 어떻게 하나요', '2026-10-05T11:00:00+09:00'),
      createMessage('1046-2', 'operator', '이담당', '설정 화면에서 할 수 있습니다', '2026-10-05T15:00:00+09:00'),
    ],
  },
  {
    id: 1047,
    status: 'checking',
    title: '쿠폰 적용',
    user: HONG,
    assigneeEmail: INACTIVE_MEMBER_EMAIL,
    createdAt: '2026-10-05T10:00:00+09:00',
    lastActivityAt: '2026-10-05T10:00:00+09:00',
    messages: [createMessage('1047-1', 'user', '홍길동', '쿠폰이 적용되지 않아요', '2026-10-05T10:00:00+09:00')],
  },
  {
    id: 1048,
    status: 'resolved',
    title: '비밀번호 변경',
    user: CHOI,
    assigneeEmail: OPERATOR_EMAIL,
    createdAt: '2026-10-04T09:00:00+09:00',
    lastActivityAt: '2026-10-04T12:00:00+09:00',
    messages: [
      createMessage('1048-1', 'user', '최보호', '비밀번호를 바꾸고 싶어요', '2026-10-04T09:00:00+09:00'),
      createMessage('1048-2', 'operator', '김운영', '설정 메뉴에서 바꿀 수 있습니다', '2026-10-04T12:00:00+09:00'),
    ],
  },
  {
    id: 1049,
    status: 'resolved',
    title: '앱 오류',
    user: LEE,
    assigneeEmail: null,
    createdAt: '2026-10-03T09:00:00+09:00',
    lastActivityAt: '2026-10-03T12:00:00+09:00',
    messages: [
      createMessage('1049-1', 'user', '이원장', '앱이 자꾸 꺼져요', '2026-10-03T09:00:00+09:00'),
      createMessage('1049-2', 'operator', '김관리', '최신 버전으로 업데이트해 주세요', '2026-10-03T12:00:00+09:00'),
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

/** 담당자 변경 알림을 가짜 서버에 남긴다(FR-BO-060). 실제 발송은 서버 몫이다. */
const addMockNotification = (notification: MockNotification) => {
  let notifications: MockNotification[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? '[]');
    if (Array.isArray(stored)) notifications = stored;
  } catch {
    /* 잘못된 개발 데이터는 비우고 다시 쌓는다. */
  }
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify([...notifications, notification]));
};

/** 표시명이 있는 팀원만 담당자로 보여 줄 수 있다. */
const toAssignee = (member: TeamMember | undefined): InquiryAssignee | null =>
  member?.displayName && member.jobRole
    ? {
        email: member.email,
        displayName: member.displayName,
        jobRole: member.jobRole,
        isActive: member.status === 'active',
      }
    : null;

/** 저장한 문의를 응답 모양으로 바꾼다. */
const toInquiryDetail = (inquiry: MockInquiry, members: TeamMember[]): InquiryDetail => {
  const { assigneeEmail, ...rest } = inquiry;
  return { ...rest, assignee: toAssignee(members.find((member) => member.email === assigneeEmail)) };
};

/** 서버 오류와 같은 모양으로 요청 거부 사유를 전달한다. */
const rejectInquiryRequest = (status: number, code: string, message: string) =>
  errorResponse(status, { code, message, errorMessage: message });

/** 모든 문의 API에서 세션(만료·비활성 포함)과 최고 관리자·운영자 역할을 검사한다(PRD 4.1, 4.5). */
const authorizeInquiryRequest = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return { denied: auth.denied };
  const { member } = auth;
  if (member.role === 'viewer') return { denied: rejectInquiryRequest(403, 'FORBIDDEN', '접근 권한이 없습니다.') };
  return { member };
};

/** 주소의 문의 번호를 숫자로 읽는다. 숫자만으로 된 값이 아니면 없는 문의로 본다. */
const findInquiryIndex = (inquiries: MockInquiry[], rawId: unknown) =>
  typeof rawId === 'string' && /^\d+$/.test(rawId) ? inquiries.findIndex((item) => item.id === Number(rawId)) : -1;

const notFoundResponse = () => rejectInquiryRequest(404, INQUIRY_ERROR_CODES.notFound, '페이지를 찾을 수 없습니다.');
const resolvedResponse = () =>
  rejectInquiryRequest(409, INQUIRY_ERROR_CODES.resolved, '해결 완료된 문의라 답변과 담당 변경을 할 수 없습니다.');
const assigneeChangedResponse = () =>
  rejectInquiryRequest(409, INQUIRY_ERROR_CODES.assigneeChanged, '담당자가 변경되었습니다.');

/** 검색(부분 일치·대소문자 무시)·필터·정렬(동률이면 번호 큰 것 먼저)을 적용한 전체 목록(PRD 4.4, 7.3). */
const filterInquiries = (inquiries: MockInquiry[], searchParams: URLSearchParams, currentEmail: string) => {
  const keyword = (searchParams.get('keyword') ?? '').toLowerCase();
  const status = searchParams.get('status');
  const userType = searchParams.get('userType');
  const assignee = searchParams.get('assignee');
  const isOldestFirst = searchParams.get('sort') === 'oldest';
  return inquiries
    .filter((inquiry) => {
      if (status && inquiry.status !== status) return false;
      if (userType && inquiry.user.type !== userType) return false;
      if (assignee === 'me' && inquiry.assigneeEmail !== currentEmail) return false;
      if (assignee === 'unassigned' && inquiry.assigneeEmail !== null) return false;
      if (assignee && assignee !== 'me' && assignee !== 'unassigned' && inquiry.assigneeEmail !== assignee) {
        return false;
      }
      if (!keyword) return true;
      return [
        inquiry.title,
        inquiry.user.name,
        inquiry.user.email,
        String(inquiry.id),
        ...inquiry.messages.map((message) => message.body),
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((left, right) => {
      const timeGap = new Date(left.lastActivityAt).getTime() - new Date(right.lastActivityAt).getTime();
      if (timeGap !== 0) return isOldestFirst ? timeGap : -timeGap;
      return right.id - left.id;
    });
};

/** 상태 전환을 적용해 저장하고 응답한다. 거부되면 최신 상태를 다시 읽도록 거부 사유를 준다. */
const applyInquiryEvent = (rawId: unknown, event: InquiryEvent) => {
  const { denied, member } = authorizeInquiryRequest();
  if (denied) return denied;
  const inquiries = getMockInquiries();
  const index = findInquiryIndex(inquiries, rawId);
  if (index < 0) return notFoundResponse();
  const inquiry = inquiries[index];
  const next = transitionInquiry(inquiry, event, member.email);
  if (!next) return inquiry.status === 'resolved' ? resolvedResponse() : assigneeChangedResponse();
  inquiries[index] = { ...inquiry, ...next };
  saveMockInquiries(inquiries);
  return okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
};

export const INQUIRY_HANDLERS = [
  http.get(mockUrl('/inquiries'), ({ request }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const searchParams = new URL(request.url).searchParams;
    const members = getMockTeamMembers();
    const items = filterInquiries(getMockInquiries(), searchParams, member.email).map((inquiry) => {
      const { createdAt: _createdAt, messages: _messages, ...summary } = toInquiryDetail(inquiry, members);
      return summary;
    });
    return pageResponse(items, Number(searchParams.get('page') ?? 0), Number(searchParams.get('size') ?? 20));
  }),
  http.get(mockUrl('/inquiries/assignees'), () => {
    const { denied } = authorizeInquiryRequest();
    if (denied) return denied;
    // 표시명이 없는 등록됨·등록 취소 팀원은 빠진다(R-담당자필터목록)
    const assignees = getMockTeamMembers()
      .filter((member) => member.status === 'active' || member.status === 'inactive')
      .map(toAssignee)
      .filter((assignee) => assignee !== null);
    return okResponse(assignees);
  }),
  http.get(mockUrl('/inquiries/:id'), ({ params }) => {
    const { denied } = authorizeInquiryRequest();
    if (denied) return denied;
    const inquiries = getMockInquiries();
    const index = findInquiryIndex(inquiries, params.id);
    return index < 0 ? notFoundResponse() : okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
  http.get(mockUrl('/inquiries/:id/adjacent'), ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const list = filterInquiries(getMockInquiries(), new URL(request.url).searchParams, member.email);
    const index = list.findIndex((inquiry) => String(inquiry.id) === params.id);
    // 지금 조건에 이 문의가 없으면(예: 미배정 필터에서 맡음) 앞뒤를 정할 수 없어 둘 다 비운다.
    return okResponse({
      prevId: index > 0 ? list[index - 1].id : null,
      nextId: index >= 0 && index < list.length - 1 ? list[index + 1].id : null,
    });
  }),
  http.post(mockUrl('/inquiries/:id/assignee'), async ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const { expectedAssigneeEmail } = (await request.json()) as { expectedAssigneeEmail: string | null };
    const inquiries = getMockInquiries();
    const index = findInquiryIndex(inquiries, params.id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const check = checkAssignRequest(inquiry, expectedAssigneeEmail);
    if (check === 'resolved') return resolvedResponse();
    if (check === 'conflict') return assigneeChangedResponse();
    const next = transitionInquiry(inquiry, 'assign', member.email);
    if (!next) return resolvedResponse();
    inquiries[index] = { ...inquiry, ...next };
    saveMockInquiries(inquiries);
    const members = getMockTeamMembers();
    const previousAssignee = members.find((item) => item.email === inquiry.assigneeEmail);
    // 이전 담당자가 활성 팀원일 때만 알린다(S-문의-034). 변경 이력 기록은 실제 서버가 한다.
    if (previousAssignee && previousAssignee.email !== member.email && previousAssignee.status === 'active') {
      addMockNotification({
        recipientEmail: previousAssignee.email,
        message: `${member.displayName} · ${member.jobRole}님이 문의의 담당자를 변경했습니다.`,
        inquiryId: inquiry.id,
        createdAt: new Date().toISOString(),
      });
    }
    return okResponse(toInquiryDetail(inquiries[index], members));
  }),
  http.delete(mockUrl('/inquiries/:id/assignee'), ({ params }) => applyInquiryEvent(params.id, 'release')),
  http.post(mockUrl('/inquiries/:id/assignee/restore'), ({ params }) => applyInquiryEvent(params.id, 'restore')),
  http.post(mockUrl('/inquiries/:id/replies'), async ({ request, params }) => {
    const { denied, member } = authorizeInquiryRequest();
    if (denied) return denied;
    const { body } = (await request.json()) as { body: string };
    if (!canSubmitReply(body, false)) {
      return rejectInquiryRequest(400, 'INQUIRY_REPLY_INVALID', '답변을 확인해 주세요.');
    }
    const inquiries = getMockInquiries();
    const index = findInquiryIndex(inquiries, params.id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const next = transitionInquiry(inquiry, 'reply', member.email);
    if (!next) return inquiry.status === 'resolved' ? resolvedResponse() : assigneeChangedResponse();
    const createdAt = new Date().toISOString();
    // 답변을 저장하면 최근 활동이 그 시각으로 바뀐다(R-최근활동-03). 사용자 앱 알림 발송은 실제 서버가 한다.
    inquiries[index] = {
      ...inquiry,
      ...next,
      lastActivityAt: createdAt,
      messages: [
        ...inquiry.messages,
        createMessage(`${inquiry.id}-${Date.now()}`, 'operator', member.displayName ?? '', body, createdAt),
      ],
    };
    saveMockInquiries(inquiries);
    return okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
  // 아래 두 주소는 앱 사용자 동작을 흉내 내는 개발용이다. 화면에서는 부르지 않고, 개발자 도구에서 fetch로 부른다.
  http.post(mockUrl('/dev/inquiries/:id/user-messages'), async ({ params, request }) => {
    const { body } = (await request.json()) as { body: string };
    const inquiries = getMockInquiries();
    const index = findInquiryIndex(inquiries, params.id);
    if (index < 0) return notFoundResponse();
    const inquiry = inquiries[index];
    const next = transitionInquiry(inquiry, 'userFollowUp', '');
    if (!next) return resolvedResponse();
    const createdAt = new Date().toISOString();
    inquiries[index] = {
      ...inquiry,
      ...next,
      lastActivityAt: createdAt,
      messages: [
        ...inquiry.messages,
        createMessage(`${inquiry.id}-${Date.now()}`, 'user', inquiry.user.name, body, createdAt),
      ],
    };
    saveMockInquiries(inquiries);
    return okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
  http.post(mockUrl('/dev/inquiries/:id/close'), ({ params }) => {
    const inquiries = getMockInquiries();
    const index = findInquiryIndex(inquiries, params.id);
    if (index < 0) return notFoundResponse();
    const next = transitionInquiry(inquiries[index], 'userClose', '');
    if (!next) return rejectInquiryRequest(409, 'INQUIRY_CLOSE_REJECTED', '답변 도착 문의만 종료할 수 있습니다.');
    inquiries[index] = { ...inquiries[index], ...next };
    saveMockInquiries(inquiries);
    return okResponse(toInquiryDetail(inquiries[index], getMockTeamMembers()));
  }),
];
