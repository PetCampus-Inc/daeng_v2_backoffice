import { http, HttpResponse } from 'msw';
import { TERM_KIND_FROM_SERVER } from '@/routes/terms/type/term-ui';
import {
  TermsEffectiveDateErrorCode,
  TermsKind,
  TermsPublishStatus,
  TermsVersionConflictErrorCode,
  TermsVersionNotDraftErrorCode,
  TermsVersionNotFoundErrorCode,
  TermsWithdrawNotAllowedErrorCode,
  type TermsVersion,
} from '@/routes/terms/type';
import { fillTermDates, getInitialTermBody } from '@/routes/terms/util/term-policy';
import type { ContentBody } from '@/type/content-body';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { countRichTextLength, createRichContent, fromContentBody, getRichText } from '@/util/rich-content';
import {
  canWithdrawTerm,
  checkPublishDate,
  fillPublishedTermDates,
  getTermList,
  isTermDate,
  kstDateOf,
  parseTermId,
  parseTermKind,
  toTermResponse,
  toTermSummaryResponse,
  type MockTerm,
  type MockTermIssue,
} from '../util/term-list';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

// 본문이 마크다운 문자열에서 블록 JSON 객체로 바뀌어 저장 키를 바꿨다. 이전 키의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-terms-v3';

/** 서버 명세의 약관 본문 글자 수 상한. */
const MOCK_TERM_BODY_MAX = 100_000;
const SEQUENCE_KEY = `${STORAGE_KEY}-sequence`;

/** KST로 적은 시각을 서버 응답처럼 UTC 문자열로 바꾼다. */
const toUtcIso = (kst: string) => new Date(kst).toISOString();

/** 공개한 버전. 본문 맨 아래 공고일자·시행일자는 공개 때 채워진 상태로 저장한다. 본문은 블록 JSON 객체다. */
function publishedFixture(
  id: number,
  kind: TermsKind,
  effectiveDate: string,
  publishedAt: string,
  text: string,
  status: TermsPublishStatus = TermsPublishStatus.PUBLISHED
): MockTerm {
  const publishedUtc = toUtcIso(publishedAt);
  const body = fillTermDates(
    createRichContent(`${text}\n\n공고일자: {{공고일}}\n시행일자: {{시행일}}`),
    effectiveDate,
    new Date(publishedUtc)
  );
  return {
    id,
    kind,
    effectiveDate,
    publishStatus: status,
    publishedAt: publishedUtc,
    updatedAt: publishedUtc,
    content: body,
    announcedDate: kstDateOf(new Date(publishedUtc)),
    version: 1,
  };
}

/** fixtures.md `약관-기본`. 서비스 이용약관 #1~#4, 개인정보 처리방침 #5~#6, 위치기반서비스 이용약관 없음. */
export const createDefaultTerms = (): MockTerm[] => {
  const service = [
    publishedFixture(1, TermsKind.SERVICE_TERMS, '2026-03-01', '2026-02-20T09:00:00+09:00', '서비스 이용약관 1판'),
    publishedFixture(2, TermsKind.SERVICE_TERMS, '2026-09-01', '2026-08-20T09:00:00+09:00', '서비스 이용약관 2판'),
    publishedFixture(
      3,
      TermsKind.SERVICE_TERMS,
      '2026-10-20',
      '2026-10-01T09:00:00+09:00',
      '고지의 의무\n{{공고일}} 공고\n이 약관은 {{시행일}}부터 시행합니다.'
    ),
  ];
  // 새 버전의 처음 본문과 같은 규칙으로 직전 공개 본문에서 날짜를 자리표시자로 되돌린 초안. 기존 초안은 시행일이 없을 수 있다.
  const startBody = getInitialTermBody(
    service.map((item) => ({
      kind: TERM_KIND_FROM_SERVER[item.kind],
      version: item.id,
      status: 'published' as const,
      effectiveDate: item.effectiveDate ?? '',
      publishedAt: item.publishedAt,
      updatedAt: item.updatedAt,
      body: fromContentBody(item.content),
      revision: item.version,
    }))
  );
  const draft: MockTerm = {
    id: 4,
    kind: TermsKind.SERVICE_TERMS,
    effectiveDate: null,
    publishStatus: TermsPublishStatus.DRAFT,
    publishedAt: null,
    updatedAt: toUtcIso('2026-10-06T15:00:00+09:00'),
    content: startBody,
    announcedDate: null,
    version: 1,
  };
  return [
    ...service,
    draft,
    publishedFixture(5, TermsKind.PRIVACY_POLICY, '2026-01-01', '2025-12-20T09:00:00+09:00', '개인정보 처리방침 1판'),
    publishedFixture(
      6,
      TermsKind.PRIVACY_POLICY,
      '2026-11-01',
      '2026-10-02T09:00:00+09:00',
      '개인정보 처리방침 철회본',
      TermsPublishStatus.WITHDRAWN
    ),
  ];
};

/** 저장된 약관을 읽는다. 잘못된 개발 데이터는 기본값으로 복구한다. */
const getMockTerms = (): MockTerm[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return createDefaultTerms();
};

const saveMockTerms = (terms: MockTerm[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));

/** 서버 오류와 같은 모양(`{ code, message }`)으로 요청 거부 사유를 전달한다. */
const rejectTermRequest = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** 입력 검증 실패 응답(400). 서버처럼 어느 값이 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (issues: MockTermIssue[]) =>
  HttpResponse.json(
    { code: ValidationFailedErrorCode.VALIDATION_FAILED, message: '입력값을 확인해 주세요.', details: issues },
    { status: 400 }
  );

const invalidIdResponse = () => rejectInvalidInput([{ field: 'id', reason: '1 이상의 정수여야 합니다.' }]);
const invalidKindResponse = () => rejectInvalidInput([{ field: 'kind', reason: '올바른 약관 종류가 아닙니다.' }]);
const invalidDateResponse = () =>
  rejectTermRequest(
    400,
    TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_INVALID_FORMAT,
    '시행일 형식이 올바르지 않습니다.'
  );
const notFoundResponse = () =>
  rejectTermRequest(404, TermsVersionNotFoundErrorCode.TERMS_VERSION_NOT_FOUND, '약관 버전을 찾을 수 없습니다.');
const versionConflictResponse = () =>
  rejectTermRequest(409, TermsVersionConflictErrorCode.TERMS_VERSION_CONFLICT, '다른 팀원이 먼저 저장했습니다.');
const notDraftResponse = () =>
  rejectTermRequest(409, TermsVersionNotDraftErrorCode.TERMS_VERSION_NOT_DRAFT, '초안만 수정·삭제·공개할 수 있습니다.');

/** 세션(만료·비활성 포함)을 검사하고, 쓰기 요청이면 최고 관리자가 아닌 계정을 거부한다. */
const authorizeTermRequest = (isWrite = false) => {
  const auth = authenticateMockRequest();
  if (auth.denied) return auth.denied;
  if (isWrite && auth.member.role !== 'SUPER_ADMIN') {
    return rejectTermRequest(403, ForbiddenErrorCode.FORBIDDEN, '접근 권한이 없습니다.');
  }
  return null;
};

/** 요청 본문에서 `version`을 읽는다. 0 이상의 정수가 아니면 undefined. */
const readVersion = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

/** 쿼리 `version`을 읽는다. 0 이상의 정수 문자열이 아니면(없음 포함) undefined. */
const readVersionQuery = (request: Request) => {
  const raw = new URL(request.url).searchParams.get('version');
  return raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
};

/** 문자열·배열·null이 아닌 JSON 객체인지 본다. 서버는 블록 안쪽 모양은 검사하지 않는다. */
const isBodyObject = (value: unknown): value is ContentBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 본문 검사: JSON 객체여야 하고 글자는 100,000자 이하다. 수정에서는 생략할 수 있다. */
const checkContent = (content: unknown, isRequired: boolean): MockTermIssue[] => {
  if (content === undefined && !isRequired) return [];
  if (!isBodyObject(content)) return [{ field: 'content', reason: '본문 블록 JSON 객체여야 합니다.' }];
  if (countRichTextLength(content) > MOCK_TERM_BODY_MAX) {
    return [{ field: 'content', reason: `${MOCK_TERM_BODY_MAX.toLocaleString()}자 이하의 글자여야 합니다.` }];
  }
  return [];
};

const versionIssue = (): MockTermIssue => ({ field: 'version', reason: '0 이상의 정수여야 합니다.' });

/** 새 번호. 종류와 관계없이 하나씩 늘어나며, 삭제한 번호는 다시 쓰지 않는다. */
const nextTermId = (terms: MockTerm[]) => {
  const id = Math.max(Number(localStorage.getItem(SEQUENCE_KEY) ?? 0), 0, ...terms.map((item) => item.id)) + 1;
  localStorage.setItem(SEQUENCE_KEY, String(id));
  return id;
};

/** 상세 응답. 시행 상태는 같은 종류의 전체 버전을 보고 정한다. */
const respondTerm = (item: MockTerm, all: MockTerm[], status = 200) =>
  HttpResponse.json(
    toTermResponse(
      item,
      all.filter((other) => other.kind === item.kind)
    ) satisfies TermsVersion,
    { status }
  );

/**
 * 약관 가짜 API. 명세대로 응답을 `data`로 감싸지 않는다. 저장(`POST`·`PATCH`, 항상 초안)과 공개(`PUT …/publication`)가 따로이고,
 * 시행일은 초안에서 비울 수 있고(생성은 생략, 수정은 `null`) 적었다면 `YYYY-MM-DD`여야 한다(400 `TERMS_EFFECTIVE_DATE_INVALID_FORMAT`).
 * 시행일이 없는 버전은 공개할 수 없다(400 `TERMS_EFFECTIVE_DATE_REQUIRED`). 공개할 때 시행일은 공개일로부터 7일 이후,
 * 같은 종류의 공개 버전 중 가장 늦은 시행일 뒤여야 한다. 공개한 버전은 수정·삭제·재공개할 수 없고(409 `TERMS_VERSION_NOT_DRAFT`),
 * 낡은 `version`은 409 `TERMS_VERSION_CONFLICT`다. 삭제·철회는 쿼리 `version`이 필수라 없거나 정수가 아니면 400, 다르면 409다.
 * 목록은 초안이 맨 위에 최근 생성순, 나머지는 시행일 내림차순(같으면 번호가 큰 것 먼저)이다.
 * 본문(`content`)은 블록 JSON 객체이며 글자 100,000자 이하다. 약관 3종 요약(`GET /terms`)과 새 버전 시작 내용(`draft-template`)은 화면이 쓰지 않아 두지 않는다.
 */
export const TERM_HANDLERS = [
  http.get(mockUrl('/terms/:kind/versions'), ({ params }) => {
    const denied = authorizeTermRequest();
    if (denied) return denied;
    const kind = parseTermKind(params.kind);
    if (!kind) return invalidKindResponse();
    const all = getMockTerms();
    const list = getTermList(all, kind);
    return HttpResponse.json(list.map((item) => toTermSummaryResponse(item, list)));
  }),
  http.post(mockUrl('/terms/:kind/versions'), async ({ request, params }) => {
    const denied = authorizeTermRequest(true);
    if (denied) return denied;
    const kind = parseTermKind(params.kind);
    if (!kind) return invalidKindResponse();
    const input = (await request.json().catch(() => null)) as { effectiveDate?: unknown; content?: unknown } | null;
    // 시행일은 생략할 수 있다(초안). 보냈다면 날짜여야 한다.
    if (input && 'effectiveDate' in input && !isTermDate(input.effectiveDate)) return invalidDateResponse();
    const issues = checkContent(input?.content, true);
    if (issues.length > 0) return rejectInvalidInput(issues);
    const all = getMockTerms();
    const item: MockTerm = {
      id: nextTermId(all),
      kind,
      effectiveDate: (input!.effectiveDate as string | undefined) ?? null,
      publishStatus: TermsPublishStatus.DRAFT,
      publishedAt: null,
      updatedAt: new Date().toISOString(),
      content: input!.content as ContentBody,
      announcedDate: null,
      version: 1,
    };
    saveMockTerms([...all, item]);
    return respondTerm(item, [...all, item], 201);
  }),
  http.get(mockUrl('/term-versions/:id'), ({ params }) => {
    const denied = authorizeTermRequest();
    if (denied) return denied;
    const id = parseTermId(params.id);
    if (id === undefined) return invalidIdResponse();
    const all = getMockTerms();
    const item = all.find((other) => other.id === id);
    return item ? respondTerm(item, all) : notFoundResponse();
  }),
  http.patch(mockUrl('/term-versions/:id'), async ({ request, params }) => {
    const denied = authorizeTermRequest(true);
    if (denied) return denied;
    const id = parseTermId(params.id);
    if (id === undefined) return invalidIdResponse();
    const input = (await request.json().catch(() => null)) as {
      effectiveDate?: unknown;
      content?: unknown;
      version?: unknown;
    } | null;
    // 시행일: 보내지 않으면 유지, `null`이면 비움, 그 밖에는 날짜여야 한다.
    if (input && 'effectiveDate' in input && input.effectiveDate !== null && !isTermDate(input.effectiveDate)) {
      return invalidDateResponse();
    }
    const version = readVersion(input?.version);
    const issues = checkContent(input?.content, false);
    if (version === undefined) issues.push(versionIssue());
    if (issues.length > 0) return rejectInvalidInput(issues);
    const all = getMockTerms();
    const index = all.findIndex((other) => other.id === id);
    if (index < 0) return notFoundResponse();
    const item = all[index];
    if (item.publishStatus !== TermsPublishStatus.DRAFT) return notDraftResponse();
    if (item.version !== version) return versionConflictResponse();
    const next: MockTerm = {
      ...item,
      effectiveDate: 'effectiveDate' in input! ? (input!.effectiveDate as string | null) : item.effectiveDate,
      content: (input!.content as ContentBody | undefined) ?? item.content,
      updatedAt: new Date().toISOString(),
      version: item.version + 1,
    };
    all[index] = next;
    saveMockTerms(all);
    return respondTerm(next, all);
  }),
  http.delete(mockUrl('/term-versions/:id'), ({ request, params }) => {
    const denied = authorizeTermRequest(true);
    if (denied) return denied;
    const id = parseTermId(params.id);
    if (id === undefined) return invalidIdResponse();
    const version = readVersionQuery(request);
    if (version === undefined) return rejectInvalidInput([versionIssue()]);
    const all = getMockTerms();
    const item = all.find((other) => other.id === id);
    if (!item) return notFoundResponse();
    if (item.publishStatus !== TermsPublishStatus.DRAFT) return notDraftResponse();
    if (item.version !== version) return versionConflictResponse();
    // 삭제한 번호를 다시 쓰지 않도록 지금까지의 가장 큰 번호를 기억해 둔다.
    localStorage.setItem(
      SEQUENCE_KEY,
      String(Math.max(Number(localStorage.getItem(SEQUENCE_KEY) ?? 0), ...all.map((other) => other.id)))
    );
    saveMockTerms(all.filter((other) => other.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.put(mockUrl('/term-versions/:id/publication'), async ({ request, params }) => {
    const denied = authorizeTermRequest(true);
    if (denied) return denied;
    const id = parseTermId(params.id);
    if (id === undefined) return invalidIdResponse();
    const input = (await request.json().catch(() => null)) as { version?: unknown } | null;
    const version = readVersion(input?.version);
    if (version === undefined) return rejectInvalidInput([versionIssue()]);
    const all = getMockTerms();
    const index = all.findIndex((other) => other.id === id);
    if (index < 0) return notFoundResponse();
    const item = all[index];
    if (item.publishStatus !== TermsPublishStatus.DRAFT) return notDraftResponse();
    if (item.version !== version) return versionConflictResponse();
    const dateError = checkPublishDate(
      item.effectiveDate,
      all.filter((other) => other.kind === item.kind)
    );
    if (dateError) return rejectTermRequest(400, dateError.code, dateError.message);
    const body = fromContentBody(item.content);
    // 서버는 빈 본문을 거절하지 않지만, 가짜 서버는 글자가 없는 본문의 공개를 입력 오류로 막는다(개발상 방어 처리).
    if (!getRichText(body).trim()) return rejectInvalidInput([{ field: 'content', reason: '본문이 비어 있습니다.' }]);
    const now = new Date();
    // 공개하면 {{공고일}}·{{시행일}}이 실제 날짜로 채워지고 이후에는 수정·삭제할 수 없다.
    const next: MockTerm = {
      ...item,
      publishStatus: TermsPublishStatus.PUBLISHED,
      publishedAt: now.toISOString(),
      announcedDate: kstDateOf(now),
      content: fillPublishedTermDates(body, item.effectiveDate!, now),
      updatedAt: now.toISOString(),
      version: item.version + 1,
    };
    all[index] = next;
    saveMockTerms(all);
    return respondTerm(next, all);
  }),
  http.delete(mockUrl('/term-versions/:id/publication'), ({ request, params }) => {
    const denied = authorizeTermRequest(true);
    if (denied) return denied;
    const id = parseTermId(params.id);
    if (id === undefined) return invalidIdResponse();
    const version = readVersionQuery(request);
    if (version === undefined) return rejectInvalidInput([versionIssue()]);
    const all = getMockTerms();
    const index = all.findIndex((other) => other.id === id);
    if (index < 0) return notFoundResponse();
    const item = all[index];
    if (!canWithdrawTerm(item)) {
      return rejectTermRequest(
        409,
        TermsWithdrawNotAllowedErrorCode.TERMS_WITHDRAW_NOT_ALLOWED,
        '시행일이 지났거나 공개 상태가 아니라 철회할 수 없습니다.'
      );
    }
    if (item.version !== version) return versionConflictResponse();
    const next: MockTerm = {
      ...item,
      publishStatus: TermsPublishStatus.WITHDRAWN,
      updatedAt: new Date().toISOString(),
      version: item.version + 1,
    };
    all[index] = next;
    saveMockTerms(all);
    return respondTerm(next, all);
  }),
];
