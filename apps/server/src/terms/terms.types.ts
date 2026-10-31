export const TERMS_KINDS = ['SERVICE_TERMS', 'PRIVACY_POLICY', 'LOCATION_TERMS'] as const;
export type TermsKind = (typeof TERMS_KINDS)[number];

/** 약관 종류의 표시 이름(PRD의 약관 3종 이름). */
export const TERMS_KIND_NAMES: Record<TermsKind, string> = {
  SERVICE_TERMS: '서비스 이용약관',
  PRIVACY_POLICY: '개인정보 처리방침',
  LOCATION_TERMS: '위치기반서비스 이용약관',
};
