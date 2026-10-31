export const TERMS_KINDS = ['SERVICE_TERMS', 'PRIVACY_POLICY', 'LOCATION_TERMS'] as const;
export type TermsKind = (typeof TERMS_KINDS)[number];
