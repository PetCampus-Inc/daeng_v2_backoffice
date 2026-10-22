import { http } from 'msw';
import { TERM_KINDS, type Term, type TermAction, type TermInput, type TermKind } from '@/routes/terms/type/term';
import {
  compareTerms,
  fillTermDates,
  getInitialTermBody,
  getTermStatus,
  parseTermDate,
  validateEffectiveDate,
} from '@/routes/terms/util/term-policy';
import { errorResponse, mockUrl, okResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';

const STORAGE_KEY = 'daeng-bo-mock-terms';
function fixture(
  kind: TermKind,
  version: number,
  status: Term['status'],
  effectiveDate: string,
  publishedAt: string | null,
  text: string
): Term {
  return {
    kind,
    version,
    status,
    effectiveDate,
    publishedAt,
    body: publishedAt
      ? fillTermDates(text + '\n\n공고일자: {{공고일}}\n시행일자: {{시행일}}', effectiveDate, new Date(publishedAt))
      : text,
    revision: 1,
    updatedAt: publishedAt ?? '2026-10-06T15:00:00+09:00',
  };
}
const SERVICE_VERSIONS = [
  fixture('service', 1, 'published', '2026-03-01', '2026-02-20T09:00:00+09:00', '서비스 이용약관 1판'),
  fixture('service', 2, 'published', '2026-09-01', '2026-08-20T09:00:00+09:00', '서비스 이용약관 2판'),
  fixture(
    'service',
    3,
    'published',
    '2026-10-20',
    '2026-10-01T09:00:00+09:00',
    '고지의 의무\n{{공고일}} 공고\n이 약관은 {{시행일}}부터 시행합니다.'
  ),
];
export const DEFAULT_TERMS: Term[] = [
  ...SERVICE_VERSIONS,
  fixture('service', 4, 'draft', '', null, getInitialTermBody(SERVICE_VERSIONS)),
  fixture('privacy', 1, 'published', '2026-01-01', '2025-12-20T09:00:00+09:00', '개인정보 처리방침 1판'),
  fixture('privacy', 2, 'withdrawn', '2026-11-01', '2026-10-02T09:00:00+09:00', '개인정보 처리방침 철회본'),
];
export function getMockTerms(): Term[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 개발 데이터 복구 */
  }
  return structuredClone(DEFAULT_TERMS);
}
function deny(status: number, code: string, message: string) {
  return errorResponse(status, { code, message, errorMessage: message });
}
function authorize(write = false) {
  const auth = authenticateMockRequest();
  if (auth.denied) return auth.denied;
  return write && auth.member.role !== 'superAdmin' ? deny(403, 'FORBIDDEN', '접근 권한이 없습니다.') : null;
}
function validInput(input: Partial<TermInput>): input is TermInput {
  return typeof input.body === 'string' && typeof input.effectiveDate === 'string';
}
/** 개발용 계약. 버전 번호 체계와 본문 블록은 서버 계약 확정 시 교체한다. */
export const TERM_HANDLERS = [
  http.get(mockUrl('/terms/:kind'), ({ params }) => {
    const denied = authorize();
    if (denied) return denied;
    if (!TERM_KINDS.includes(params.kind as TermKind)) return deny(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.');
    return okResponse(
      getMockTerms()
        .filter((item) => item.kind === params.kind)
        .sort(compareTerms)
    );
  }),
  http.get(mockUrl('/terms/:kind/:version'), ({ params }) => {
    const denied = authorize();
    if (denied) return denied;
    const item = getMockTerms().find((item) => item.kind === params.kind && item.version === Number(params.version));
    return item ? okResponse(item) : deny(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.');
  }),
  http.post(mockUrl('/terms/:kind'), async ({ request, params }) => {
    const denied = authorize(true);
    if (denied) return denied;
    if (!TERM_KINDS.includes(params.kind as TermKind)) return deny(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.');
    const input = (await request.json()) as TermInput & { action: TermAction };
    if (!validInput(input) || !['save', 'publish'].includes(input.action)) {
      return deny(400, 'INVALID_TERM', '입력 내용을 확인해 주세요.');
    }
    const all = getMockTerms();
    const versions = all.filter((item) => item.kind === params.kind);
    const error =
      input.action === 'publish'
        ? validateEffectiveDate(input.effectiveDate, versions) || (!input.body.trim() ? '본문을 입력해 주세요.' : null)
        : null;
    if (error) return deny(400, 'INVALID_TERM', error);
    const now = new Date();
    const sequenceKey = `${STORAGE_KEY}-${params.kind}-sequence`;
    const version =
      Math.max(Number(localStorage.getItem(sequenceKey)) || 0, 0, ...versions.map((item) => item.version)) + 1;
    const item: Term = {
      kind: params.kind as TermKind,
      version,
      status: input.action === 'publish' ? 'published' : 'draft',
      effectiveDate: parseTermDate(input.effectiveDate) ?? input.effectiveDate,
      body:
        input.action === 'publish' ? fillTermDates(input.body, parseTermDate(input.effectiveDate)!, now) : input.body,
      publishedAt: input.action === 'publish' ? now.toISOString() : null,
      updatedAt: now.toISOString(),
      revision: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, item]));
    localStorage.setItem(sequenceKey, String(version));
    return okResponse(item, 201);
  }),
  http.patch(mockUrl('/terms/:kind/:version'), async ({ request, params }) => {
    const denied = authorize(true);
    if (denied) return denied;
    const input = (await request.json()) as TermInput & { revision: number; action: TermAction };
    const all = getMockTerms();
    const item = all.find((item) => item.kind === params.kind && item.version === Number(params.version));
    if (!item) return deny(404, 'NOT_FOUND', '다른 팀원이 삭제한 초안입니다.');
    if (item.revision !== input.revision) return deny(409, 'CONFLICT', '다른 팀원이 먼저 저장한 내용이 있습니다.');
    const versions = all.filter((other) => other.kind === item.kind);
    if (input.action === 'withdraw') {
      if (getTermStatus(item, versions) !== '예정') {
        return deny(409, 'STATE_CHANGED', '이미 시행되었거나 철회된 버전입니다. 최신 상태를 확인해 주세요.');
      }
      item.status = 'withdrawn';
    } else {
      if (!['save', 'publish'].includes(input.action) || item.status !== 'draft') {
        return deny(409, 'STATE_CHANGED', '공개한 버전은 수정할 수 없습니다.');
      }
      if (!validInput(input)) return deny(400, 'INVALID_TERM', '입력 내용을 확인해 주세요.');
      if (input.action === 'publish') {
        const error =
          validateEffectiveDate(input.effectiveDate, versions) || (!input.body.trim() ? '본문을 입력해 주세요.' : null);
        if (error) return deny(400, 'INVALID_TERM', error);
      }
      item.effectiveDate = parseTermDate(input.effectiveDate) ?? input.effectiveDate;
      item.body = input.action === 'publish' ? fillTermDates(input.body, item.effectiveDate) : input.body;
      if (input.action === 'publish') {
        item.status = 'published';
        item.publishedAt = new Date().toISOString();
      }
    }
    item.revision++;
    item.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return okResponse(item);
  }),
  http.delete(mockUrl('/terms/:kind/:version'), async ({ request, params }) => {
    const denied = authorize(true);
    if (denied) return denied;
    const input = (await request.json()) as { revision: number };
    const all = getMockTerms();
    const item = all.find((item) => item.kind === params.kind && item.version === Number(params.version));
    if (!item) return deny(404, 'NOT_FOUND', '다른 팀원이 삭제한 초안입니다.');
    if (item.status !== 'draft' || item.revision !== input.revision) {
      return deny(409, 'CONFLICT', '다른 팀원이 먼저 저장한 내용이 있습니다.');
    }
    const sequenceKey = `${STORAGE_KEY}-${item.kind}-sequence`;
    localStorage.setItem(
      sequenceKey,
      String(
        Math.max(
          Number(localStorage.getItem(sequenceKey)) || 0,
          ...all.filter((other) => other.kind === item.kind).map((other) => other.version)
        )
      )
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((other) => other !== item)));
    return okResponse(null);
  }),
];
