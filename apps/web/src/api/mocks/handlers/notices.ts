import { http, HttpResponse } from 'msw';
import {
  NoticeContentRequiredErrorCode,
  NoticeNotFoundErrorCode,
  NoticeNotDraftErrorCode,
  NoticeNotPublishedErrorCode,
  NoticePublishConflictErrorCode,
  NoticeStatus,
  NoticeVersionConflictErrorCode,
  type NoticePage,
} from '@/routes/notices/type';
import { createNoticeBody } from '@/routes/notices/util/notice-policy';
import { fromNoticeBodyResponse, toNoticeBodyRequest } from '@/routes/notices/util/notice-body';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { getRichText } from '@/util/rich-content';
import {
  getNoticeList,
  MOCK_NOTICE_BODY_MAX,
  MOCK_NOTICE_TITLE_MAX,
  parseNoticeId,
  parseNoticeListQuery,
  type MockNotice,
  type MockNoticeQueryIssue,
} from '../util/notice-list';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

// 서버 모양(대문자 상태, 본문 문자열, version)으로 저장 모양을 바꿔 저장 키를 바꿨다. 이전 키(`daeng-bo-mock-notices`)의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-notices-v2';

/** 본문은 서버가 문자열로만 받는다. 지금은 화면의 블록 값을 JSON 문자열로 저장한다(OQ-P4). */
const createBody = (text: string) => toNoticeBodyRequest(createNoticeBody(text));

/** KST로 적은 시각을 서버 응답처럼 UTC 문자열로 바꾼다. */
const toUtcIso = (kst: string) => new Date(kst).toISOString();

/** fixtures.md `공지-기본` 5건. 시각은 KST로 적는다. */
export const createDefaultNotices = (): MockNotice[] => [
  {
    id: 14,
    status: NoticeStatus.DRAFT,
    title: '11월 이벤트 안내',
    body: createBody('이벤트 준비 중'),
    images: [],
    createdAt: toUtcIso('2026-10-06T15:00:00+09:00'),
    publishedAt: null,
    updatedAt: toUtcIso('2026-10-06T15:00:00+09:00'),
    version: 1,
  },
  {
    id: 13,
    status: NoticeStatus.DRAFT,
    title: '',
    body: createBody(''),
    images: [],
    createdAt: toUtcIso('2026-10-06T15:00:00+09:00'),
    publishedAt: null,
    updatedAt: toUtcIso('2026-10-06T15:00:00+09:00'),
    version: 1,
  },
  {
    id: 12,
    status: NoticeStatus.PUBLISHED,
    title: '10월 서비스 점검 안내',
    body: createBody(
      '더 나은 서비스를 위해 시스템 점검을 진행합니다.\n점검 중에는 서비스 이용이 일시적으로 제한될 수 있습니다. 이용에 참고해 주세요.'
    ),
    images: [],
    createdAt: toUtcIso('2026-09-30T09:00:00+09:00'),
    publishedAt: toUtcIso('2026-10-01T10:00:00+09:00'),
    updatedAt: toUtcIso('2026-10-03T15:00:00+09:00'),
    version: 1,
  },
  {
    id: 11,
    status: NoticeStatus.UNPUBLISHED,
    title: '추석 연휴 고객센터 안내',
    body: createBody(
      '추석 연휴 동안 고객센터가 쉬어갑니다.\n남겨 주신 문의는 연휴가 끝난 뒤 순서대로 답변드리겠습니다.'
    ),
    images: [],
    createdAt: toUtcIso('2026-09-30T08:00:00+09:00'),
    publishedAt: toUtcIso('2026-10-01T10:00:00+09:00'),
    updatedAt: toUtcIso('2026-10-02T09:00:00+09:00'),
    version: 1,
  },
  {
    id: 10,
    status: NoticeStatus.PUBLISHED,
    title: '[TEST] 공지사항 테스트',
    body: createBody('공지사항 테스트입니다.'),
    images: [],
    createdAt: toUtcIso('2026-09-01T09:00:00+09:00'),
    publishedAt: toUtcIso('2026-09-01T10:00:00+09:00'),
    updatedAt: toUtcIso('2026-09-01T10:00:00+09:00'),
    version: 1,
  },
];

/** 저장된 공지를 읽는다. 잘못된 개발 데이터는 기본값으로 복구한다. */
const getMockNotices = (): MockNotice[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return createDefaultNotices();
};

const saveMockNotices = (notices: MockNotice[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));

/** 서버 오류와 같은 모양(`{ code, message }`)으로 요청 거부 사유를 전달한다. */
const rejectNoticeRequest = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** 입력 검증 실패 응답(400). 서버처럼 어느 값이 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (issues: MockNoticeQueryIssue[]) =>
  HttpResponse.json(
    { code: ValidationFailedErrorCode.VALIDATION_FAILED, message: '입력값을 확인해 주세요.', details: issues },
    { status: 400 }
  );

const invalidIdResponse = () => rejectInvalidInput([{ field: 'id', reason: '1 이상의 정수여야 합니다.' }]);
const notFoundResponse = () =>
  rejectNoticeRequest(404, NoticeNotFoundErrorCode.NOTICE_NOT_FOUND, '공지를 찾을 수 없습니다.');
const versionConflictResponse = () =>
  rejectNoticeRequest(409, NoticeVersionConflictErrorCode.NOTICE_VERSION_CONFLICT, '다른 팀원이 먼저 저장했습니다.');
const contentRequiredResponse = () =>
  rejectNoticeRequest(400, NoticeContentRequiredErrorCode.NOTICE_CONTENT_REQUIRED, '제목과 본문을 입력해 주세요.');

/** 세션(만료·비활성 포함)을 검사하고, 쓰기 요청이면 조회자를 거부한다. */
const authorizeNoticeRequest = (isWrite = false) => {
  const auth = authenticateMockRequest();
  if (auth.denied) return auth.denied;
  if (isWrite && auth.member.role === 'VIEWER') {
    return rejectNoticeRequest(403, ForbiddenErrorCode.FORBIDDEN, '접근 권한이 없습니다.');
  }
  return null;
};

/** 서버처럼 제목·본문 길이(최대 50·5,000자)만 검사한다. 비어 있어도 된다. */
const checkContentLength = (title: unknown, body: unknown, isRequired: boolean) => {
  const issues: MockNoticeQueryIssue[] = [];
  if (title === undefined && !isRequired) {
    /* 보내지 않은 값은 그대로 둔다. */
  } else if (typeof title !== 'string' || title.length > MOCK_NOTICE_TITLE_MAX) {
    issues.push({ field: 'title', reason: `${MOCK_NOTICE_TITLE_MAX}자 이하의 글자여야 합니다.` });
  }
  if (body === undefined && !isRequired) {
    /* 보내지 않은 값은 그대로 둔다. */
  } else if (typeof body !== 'string' || body.length > MOCK_NOTICE_BODY_MAX) {
    issues.push({ field: 'body', reason: `${MOCK_NOTICE_BODY_MAX}자 이하의 글자여야 합니다.` });
  }
  return issues;
};

/** 제목이나 본문에 글자가 없으면 게시할 수 없다(서버는 마크다운 글자 기준, 가짜 서버는 블록 값의 글자 기준). */
const isContentEmpty = (notice: Pick<MockNotice, 'title' | 'body'>) =>
  notice.title.trim() === '' || getRichText(fromNoticeBodyResponse(notice.body)).trim() === '';

/** 요청 본문에서 `version`을 읽는다. 0 이상의 정수가 아니면 undefined. */
const readVersion = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

/**
 * 공지 가짜 API. 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 저장(`POST`·`PATCH`)과 게시(`PUT`·`DELETE`
 * `/publication`)가 따로다. 서버처럼 50자를 넘는 검색어·제목, 5,000자를 넘는 본문은 400으로, 비어 있는 제목·본문의 게시는
 * 400 `NOTICE_CONTENT_REQUIRED`로, 낡은 `version`은 409로 거절한다. 게시 해제·삭제는 `version`을 확인하지 않는다.
 * 이미지 업로드는 연결하지 않아 주소를 두지 않는다.
 */
export const NOTICE_HANDLERS = [
  http.get(mockUrl('/notices'), ({ request }) => {
    const denied = authorizeNoticeRequest();
    if (denied) return denied;
    const parsed = parseNoticeListQuery(new URL(request.url).searchParams);
    if (parsed.issues) return rejectInvalidInput(parsed.issues);
    const { filter, page, size } = parsed;
    const notices = getNoticeList(getMockNotices(), filter);
    const body: NoticePage = {
      items: notices
        .slice((page - 1) * size, page * size)
        .map(({ body: _body, images: _images, version: _version, ...summary }) => summary),
      page,
      size,
      totalItems: notices.length,
      totalPages: Math.ceil(notices.length / size),
    };
    return HttpResponse.json(body);
  }),
  http.get(mockUrl('/notices/:id'), ({ params }) => {
    const denied = authorizeNoticeRequest();
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const notice = getMockNotices().find((item) => item.id === id);
    return notice ? HttpResponse.json(notice) : notFoundResponse();
  }),
  http.post(mockUrl('/notices'), async ({ request }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const input = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
    const issues = checkContentLength(input?.title, input?.body, true);
    if (issues.length > 0) return rejectInvalidInput(issues);
    const notices = getMockNotices();
    const now = new Date().toISOString();
    const sequenceKey = `${STORAGE_KEY}-sequence`;
    const id = Math.max(Number(localStorage.getItem(sequenceKey) ?? 14), 14, ...notices.map((item) => item.id)) + 1;
    const notice: MockNotice = {
      id,
      status: NoticeStatus.DRAFT,
      title: input!.title as string,
      body: input!.body as string,
      images: [],
      createdAt: now,
      publishedAt: null,
      updatedAt: now,
      version: 1,
    };
    saveMockNotices([...notices, notice]);
    localStorage.setItem(sequenceKey, String(id));
    return HttpResponse.json(notice, { status: 201 });
  }),
  http.patch(mockUrl('/notices/:id'), async ({ request, params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const input = (await request.json().catch(() => null)) as {
      title?: unknown;
      body?: unknown;
      version?: unknown;
    } | null;
    const version = readVersion(input?.version);
    const issues = checkContentLength(input?.title, input?.body, false);
    if (version === undefined) issues.push({ field: 'version', reason: '0 이상의 정수여야 합니다.' });
    if (issues.length > 0) return rejectInvalidInput(issues);
    const notices = getMockNotices();
    const index = notices.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const notice = notices[index];
    if (notice.version !== version) return versionConflictResponse();
    const next: MockNotice = {
      ...notice,
      title: (input!.title as string | undefined) ?? notice.title,
      body: (input!.body as string | undefined) ?? notice.body,
      updatedAt: new Date().toISOString(),
      version: notice.version + 1,
    };
    // 게시된 적 있는 공지는 제목·본문을 비울 수 없다. 상태·게시일·정렬 순서는 바뀌지 않는다.
    if (notice.publishedAt !== null && isContentEmpty(next)) return contentRequiredResponse();
    notices[index] = next;
    saveMockNotices(notices);
    return HttpResponse.json(next);
  }),
  http.delete(mockUrl('/notices/:id'), ({ params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const notices = getMockNotices();
    const notice = notices.find((item) => item.id === id);
    if (!notice) return notFoundResponse();
    if (notice.status !== NoticeStatus.DRAFT) {
      return rejectNoticeRequest(409, NoticeNotDraftErrorCode.NOTICE_NOT_DRAFT, '초안만 삭제할 수 있습니다.');
    }
    saveMockNotices(notices.filter((item) => item.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.put(mockUrl('/notices/:id/publication'), async ({ request, params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const input = (await request.json().catch(() => null)) as { version?: unknown } | null;
    const version = readVersion(input?.version);
    if (version === undefined) return rejectInvalidInput([{ field: 'version', reason: '0 이상의 정수여야 합니다.' }]);
    const notices = getMockNotices();
    const index = notices.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const notice = notices[index];
    if (notice.version !== version) return versionConflictResponse();
    if (notice.status === NoticeStatus.PUBLISHED) {
      return rejectNoticeRequest(
        409,
        NoticePublishConflictErrorCode.NOTICE_ALREADY_PUBLISHED,
        '이미 게시된 공지입니다.'
      );
    }
    if (isContentEmpty(notice)) return contentRequiredResponse();
    const now = new Date().toISOString();
    // 최초 게시일시는 재게시해도 유지된다.
    const next: MockNotice = {
      ...notice,
      status: NoticeStatus.PUBLISHED,
      publishedAt: notice.publishedAt ?? now,
      updatedAt: now,
      version: notice.version + 1,
    };
    notices[index] = next;
    saveMockNotices(notices);
    return HttpResponse.json(next);
  }),
  http.delete(mockUrl('/notices/:id/publication'), ({ params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const notices = getMockNotices();
    const index = notices.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const notice = notices[index];
    if (notice.status !== NoticeStatus.PUBLISHED) {
      return rejectNoticeRequest(409, NoticeNotPublishedErrorCode.NOTICE_NOT_PUBLISHED, '게시 중인 공지가 아닙니다.');
    }
    const next: MockNotice = {
      ...notice,
      status: NoticeStatus.UNPUBLISHED,
      updatedAt: new Date().toISOString(),
      version: notice.version + 1,
    };
    notices[index] = next;
    saveMockNotices(notices);
    return HttpResponse.json(next);
  }),
];
