import type { RichContent } from '@/type/rich-content';

export const TERM_KINDS = ['service', 'privacy', 'location'] as const;
export type TermKind = (typeof TERM_KINDS)[number];
export const TERM_KIND_LABELS: Record<TermKind, string> = {
  service: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  location: '위치기반서비스 이용약관',
};
export type TermStatus = 'draft' | 'published' | 'withdrawn';
export type TermDisplayStatus = '초안' | '예정' | '현행' | '과거' | '철회';
/** 서식은 BO 개발용 블록으로 보존하며 서버·앱 계약은 OQ-P4에서 확인한다. */
export type Term = {
  kind: TermKind;
  version: number;
  status: TermStatus;
  effectiveDate: string;
  body: RichContent;
  publishedAt: string | null;
  updatedAt: string;
  revision: number;
};
export type TermInput = Pick<Term, 'effectiveDate' | 'body'>;
export type TermAction = 'save' | 'publish' | 'withdraw' | 'delete';
