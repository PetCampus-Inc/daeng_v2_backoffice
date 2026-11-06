import { delay, http, HttpResponse } from 'msw';
import {
  NoticeContentRequiredErrorCode,
  NoticeImageInvalidErrorCode,
  NoticeNotFoundErrorCode,
  NoticeNotDraftErrorCode,
  NoticeNotPublishedErrorCode,
  NoticePublishConflictErrorCode,
  NoticeStatus,
  NoticeVersionConflictErrorCode,
  type Notice,
  type NoticePage,
} from '@/routes/notices/type';
import { createNoticeBody } from '@/routes/notices/util/notice-policy';
import type { ContentBody } from '@/type/content-body';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { countRichTextLength, getRichText, isRichContent } from '@/util/rich-content';
import {
  getNoticeList,
  MOCK_NOTICE_BODY_MAX,
  MOCK_NOTICE_TITLE_MAX,
  parseNoticeId,
  parseNoticeListQuery,
  type MockNotice,
  type MockNoticeQueryIssue,
} from '../util/notice-list';
import {
  attachNoticeImages,
  createEmptyImageStore,
  isValidUploadRequest,
  MOCK_TEMP_KEY_PREFIX,
  removeNoticeImages,
  toPreviewBody,
  type MockImageStore,
} from '../util/notice-image';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

// 본문이 마크다운 문자열에서 블록 JSON 객체로 바뀌어 저장 키를 바꿨다. 이전 키의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-notices-v3';

// 공지 이미지(확정된 이미지, 올린 임시 파일)를 따로 저장한다. 파일 내용은 저장하지 않고 이름만 둔다.
const IMAGE_STORAGE_KEY = 'daeng-bo-mock-notice-images-v1';
/** 가짜 파일 올리기 주소의 서버. 실제로는 저장소(S3)의 서명된 주소라 BO 서버와 다른 곳이다. */
const MOCK_UPLOAD_ORIGIN = 'https://mock-upload.knockdog.test';

/** 줄마다 문단인 블록 JSON 본문을 만든다. 글자가 없으면 빈 문단 하나다. */
const createBody = (text: string): ContentBody => createNoticeBody(text);

/** KST로 적은 시각을 서버 응답처럼 UTC 문자열로 바꾼다. */
const toUtcIso = (kst: string) => new Date(kst).toISOString();

/** fixtures.md `공지-기본` 5건. 시각은 KST로 적는다. */
export const createDefaultNotices = (): MockNotice[] => [
  {
    id: 14,
    status: NoticeStatus.DRAFT,
    title: '11월 이벤트 안내',
    body: createBody('이벤트 준비 중'),
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

/** 저장된 이미지 정보를 읽는다. 잘못된 개발 데이터는 빈 저장소로 복구한다. */
const getImageStore = (): MockImageStore => {
  try {
    const stored = JSON.parse(localStorage.getItem(IMAGE_STORAGE_KEY) ?? 'null');
    if (stored && Array.isArray(stored.images)) return { ...createEmptyImageStore(), ...stored };
  } catch {
    /* 잘못된 개발 데이터는 빈 저장소로 복구한다. */
  }
  return createEmptyImageStore();
};

const saveImageStore = (store: MockImageStore) => localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(store));

/** 이미지 보기 주소. 서버의 임시 다운로드 주소 자리이며, 아래 SVG 응답 핸들러가 받는다. */
const getImageUrl = (imageId: number) => `${location.origin}/mock-notice-images/${imageId}.svg`;

/** 본문 이미지 규칙 위반(10장 초과·없는 임시 키·남의 이미지 등). 서버(BFF)는 이를 본문 검증 실패 400으로 돌려준다. */
const invalidBodyResponse = () =>
  HttpResponse.json(
    {
      code: ValidationFailedErrorCode.VALIDATION_FAILED,
      message: '입력값을 확인해 주세요.',
      details: [{ field: 'body', reason: '본문 형식 또는 이미지 참조가 올바르지 않습니다.' }],
    },
    { status: 400 }
  );

/** SVG 안에 넣을 글자에서 태그 기호를 바꾼다. */
const escapeSvgText = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

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

/** 서버처럼 제목은 50자, 본문은 JSON 객체이며 글자 5,000자까지만 검사한다. 비어 있어도 된다. */
const checkContentLength = (title: unknown, body: unknown, isRequired: boolean) => {
  const issues: MockNoticeQueryIssue[] = [];
  if (title === undefined && !isRequired) {
    /* 보내지 않은 값은 그대로 둔다. */
  } else if (typeof title !== 'string' || title.length > MOCK_NOTICE_TITLE_MAX) {
    issues.push({ field: 'title', reason: `${MOCK_NOTICE_TITLE_MAX}자 이하의 글자여야 합니다.` });
  }
  if (body === undefined && !isRequired) {
    /* 보내지 않은 값은 그대로 둔다. */
  } else if (!isBodyObject(body)) {
    issues.push({ field: 'body', reason: '본문 블록 JSON 객체여야 합니다.' });
  } else if (countRichTextLength(body) > MOCK_NOTICE_BODY_MAX) {
    issues.push({ field: 'body', reason: `${MOCK_NOTICE_BODY_MAX}자 이하의 글자여야 합니다.` });
  }
  return issues;
};

/** 문자열·배열·null이 아닌 JSON 객체인지 본다. 서버는 블록 안쪽 모양은 검사하지 않는다. */
const isBodyObject = (value: unknown): value is ContentBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 제목이나 본문에 글자가 없으면 게시할 수 없다. */
const isContentEmpty = (notice: Pick<MockNotice, 'title' | 'body'>) =>
  notice.title.trim() === '' || (isRichContent(notice.body) ? getRichText(notice.body).trim() === '' : true);

/** 저장해 둔 공지를 서버 상세 응답으로 바꾼다. 화면용 본문(`previewBody`)은 이미지 블록에 보기 주소가 채워진다. */
const toNoticeResponse = (notice: MockNotice): Notice => ({
  ...notice,
  previewBody: toPreviewBody(notice.body, getImageStore(), getImageUrl),
});

/** 쿼리 문자열의 `version`을 읽는다. 0 이상의 정수 문자열이 아니면 undefined. */
const readVersionQuery = (request: Request) => {
  const value = new URL(request.url).searchParams.get('version');
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
};

/** 요청 본문에서 `version`을 읽는다. 0 이상의 정수가 아니면 undefined. */
const readVersion = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

/**
 * 공지 가짜 API. 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 저장(`POST`·`PATCH`)과 게시(`PUT`·`DELETE`
 * `/publication`)가 따로다. 서버처럼 50자를 넘는 검색어·제목, 5,000자를 넘는 본문은 400으로, 비어 있는 제목·본문의 게시는
 * 400 `NOTICE_CONTENT_REQUIRED`로, 낡은 `version`은 409로 거절한다. 삭제·게시 해제는 `version` 쿼리가 필수이며 없으면 400, 다르면 409다.
 * 이미지: 업로드 주소 발급(`POST /notices/images/upload-urls`)은 JPEG·PNG, 파일당 20MB, 한 번에 10개, 확장자와 형식이 맞아야 하며
 * 어기면 400 `NOTICE_IMAGE_INVALID`다. 파일 올리기(PUT)는 가짜 저장소 주소가 받고, 파일 이름에 `upload-fail`이 있으면 500,
 * `upload-slow`가 있으면 3초 늦게 응답해 실패·지연을 다시 만들 수 있다. 저장할 때 본문 이미지의 `tempKey`를 `imageId`로 확정하고
 * (이미지 10장 초과·올리지 않았거나 이미 쓴 `tempKey`·`originalFilename` 누락·남의 `imageId`는 본문 검증 실패 400, `url`은 버린다)
 * 응답에는 화면용 본문에 보기 주소를 채운다.
 */
export const NOTICE_HANDLERS = [
  http.post(mockUrl('/notices/images/upload-urls'), async ({ request }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const input = await request.json().catch(() => null);
    const notices = getMockNotices();
    if (!isValidUploadRequest(input, (noticeId) => notices.some((item) => item.id === noticeId))) {
      return rejectNoticeRequest(
        400,
        NoticeImageInvalidErrorCode.NOTICE_IMAGE_INVALID,
        '이미지 업로드 요청이 올바르지 않습니다.'
      );
    }
    const files = (input as { files: { fileName: string }[] }).files;
    const urls = files.map((file) => {
      const tempKey = `${MOCK_TEMP_KEY_PREFIX}${crypto.randomUUID()}`;
      const mode = file.fileName.includes('upload-fail')
        ? 'fail'
        : file.fileName.includes('upload-slow')
          ? 'slow'
          : 'ok';
      return { tempKey, uploadUrl: `${MOCK_UPLOAD_ORIGIN}/${tempKey}?mode=${mode}` };
    });
    return HttpResponse.json(urls);
  }),
  // 저장소(S3)로 직접 올리는 요청이라 BO 세션 검사가 없다.
  http.put(`${MOCK_UPLOAD_ORIGIN}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    if (mode === 'slow') await delay(3000);
    if (mode === 'fail') return new HttpResponse(null, { status: 500 });
    const tempKey = decodeURIComponent(url.pathname.slice(1));
    const store = getImageStore();
    saveImageStore({ ...store, uploadedTempKeys: [...store.uploadedTempKeys, tempKey] });
    return new HttpResponse(null, { status: 200 });
  }),
  // 이미지 보기 주소(임시 다운로드 주소 자리). 실제 파일 대신 파일 이름을 적은 그림을 돌려준다.
  http.get('/mock-notice-images/:file', ({ params }) => {
    const imageId = Number(String(params.file).replace(/\.svg$/, ''));
    const image = getImageStore().images.find((item) => item.id === imageId);
    if (!image) return new HttpResponse(null, { status: 404 });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#e8eef7"/><text x="240" y="130" text-anchor="middle" font-size="22" fill="#33415c">공지 이미지 #${image.id}</text><text x="240" y="165" text-anchor="middle" font-size="16" fill="#5c677d">${escapeSvgText(image.originalFilename)}</text></svg>`;
    return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
  }),
  http.get(mockUrl('/notices'), ({ request }) => {
    const denied = authorizeNoticeRequest();
    if (denied) return denied;
    const parsed = parseNoticeListQuery(new URL(request.url).searchParams);
    if (parsed.issues) return rejectInvalidInput(parsed.issues);
    const { filter, page, size } = parsed;
    const notices = getNoticeList(getMockNotices(), filter);
    const body: NoticePage = {
      items: notices.slice((page - 1) * size, page * size).map(({ body: _body, ...summary }) => summary),
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
    return notice ? HttpResponse.json(toNoticeResponse(notice)) : notFoundResponse();
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
    const attached = attachNoticeImages(input!.body as ContentBody, id, getImageStore());
    if (!attached) return invalidBodyResponse();
    saveImageStore(attached.store);
    const notice: MockNotice = {
      id,
      status: NoticeStatus.DRAFT,
      title: input!.title as string,
      body: attached.body,
      createdAt: now,
      publishedAt: null,
      updatedAt: now,
      version: 1,
    };
    saveMockNotices([...notices, notice]);
    localStorage.setItem(sequenceKey, String(id));
    return HttpResponse.json(toNoticeResponse(notice), { status: 201 });
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
    const attached =
      input!.body === undefined ? null : attachNoticeImages(input!.body as ContentBody, id, getImageStore());
    if (input!.body !== undefined && !attached) return invalidBodyResponse();
    const next: MockNotice = {
      ...notice,
      title: (input!.title as string | undefined) ?? notice.title,
      body: attached?.body ?? notice.body,
      updatedAt: new Date().toISOString(),
      version: notice.version + 1,
    };
    // 게시된 적 있는 공지는 제목·본문을 비울 수 없다. 상태·게시일·정렬 순서는 바뀌지 않는다.
    if (notice.publishedAt !== null && isContentEmpty(next)) return contentRequiredResponse();
    if (attached) saveImageStore(attached.store);
    notices[index] = next;
    saveMockNotices(notices);
    return HttpResponse.json(toNoticeResponse(next));
  }),
  http.delete(mockUrl('/notices/:id'), ({ request, params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const version = readVersionQuery(request);
    if (version === undefined) return rejectInvalidInput([{ field: 'version', reason: '0 이상의 정수여야 합니다.' }]);
    const notices = getMockNotices();
    const notice = notices.find((item) => item.id === id);
    if (!notice) return notFoundResponse();
    if (notice.version !== version) return versionConflictResponse();
    if (notice.status !== NoticeStatus.DRAFT) {
      return rejectNoticeRequest(409, NoticeNotDraftErrorCode.NOTICE_NOT_DRAFT, '초안만 삭제할 수 있습니다.');
    }
    saveMockNotices(notices.filter((item) => item.id !== id));
    saveImageStore(removeNoticeImages(getImageStore(), id));
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
    return HttpResponse.json(toNoticeResponse(next));
  }),
  http.delete(mockUrl('/notices/:id/publication'), ({ request, params }) => {
    const denied = authorizeNoticeRequest(true);
    if (denied) return denied;
    const id = parseNoticeId(params.id);
    if (id === undefined) return invalidIdResponse();
    const version = readVersionQuery(request);
    if (version === undefined) return rejectInvalidInput([{ field: 'version', reason: '0 이상의 정수여야 합니다.' }]);
    const notices = getMockNotices();
    const index = notices.findIndex((item) => item.id === id);
    if (index < 0) return notFoundResponse();
    const notice = notices[index];
    if (notice.version !== version) return versionConflictResponse();
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
    return HttpResponse.json(toNoticeResponse(next));
  }),
];
