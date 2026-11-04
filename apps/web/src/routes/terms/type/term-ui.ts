import type { RichContent } from '@/type/rich-content';
import { TermsKind as ServerTermsKind } from './terms-kind';
import { TermsPublishStatus as ServerTermsPublishStatus } from './terms-publish-status';

/** 약관 종류. 화면 값(주소 `?kind=`)은 소문자, 서버 값은 대문자다. */
export const TERM_KINDS = ['service', 'privacy', 'location'] as const;
export type TermKind = (typeof TERM_KINDS)[number];
export const TERM_KIND_LABELS: Record<TermKind, string> = {
  service: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  location: '위치기반서비스 이용약관',
};
/** 화면 종류에 맞는 서버 값(대문자). 조회 경로와 저장 요청에 쓴다. */
export const TERM_KIND_REQUEST_VALUES: Record<TermKind, ServerTermsKind> = {
  service: ServerTermsKind.SERVICE_TERMS,
  privacy: ServerTermsKind.PRIVACY_POLICY,
  location: ServerTermsKind.LOCATION_TERMS,
};
/** 서버 종류에 맞는 화면 값(소문자). */
export const TERM_KIND_FROM_SERVER: Record<ServerTermsKind, TermKind> = {
  [ServerTermsKind.SERVICE_TERMS]: 'service',
  [ServerTermsKind.PRIVACY_POLICY]: 'privacy',
  [ServerTermsKind.LOCATION_TERMS]: 'location',
};

/** 공개 상태. 화면 값은 소문자, 서버 값은 대문자다. */
export type TermStatus = 'draft' | 'published' | 'withdrawn';
/** 서버 공개 상태에 맞는 화면 값(소문자). */
export const TERM_STATUS_FROM_SERVER: Record<ServerTermsPublishStatus, TermStatus> = {
  [ServerTermsPublishStatus.DRAFT]: 'draft',
  [ServerTermsPublishStatus.PUBLISHED]: 'published',
  [ServerTermsPublishStatus.WITHDRAWN]: 'withdrawn',
};
export type TermDisplayStatus = '초안' | '예정' | '현행' | '과거' | '철회';

/**
 * 화면이 쓰는 목록 한 행.
 * `version`(화면의 버전 번호)은 서버 `id`다. 약관 종류와 관계없이 하나씩 늘어나는 번호이며 `#id`로 보여 준다.
 * `effectiveDate`는 `YYYY-MM-DD`이고 서버가 비워 둔 시행일은 빈 문자열이다.
 */
export type TermSummary = {
  kind: TermKind;
  version: number;
  status: TermStatus;
  effectiveDate: string;
  publishedAt: string | null;
  updatedAt: string;
};
/**
 * 화면이 쓰는 상세. 본문은 블록 값이다(서버는 마크다운 문자열, OQ-P4).
 * `revision`(동시 수정 값)은 서버 `version`이다. 수정·공개 요청에 그대로 보낸다.
 */
export type Term = TermSummary & { body: RichContent; revision: number };
export type TermInput = Pick<Term, 'effectiveDate' | 'body'>;
