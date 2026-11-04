/** 단계 탭(service-admin.html `applicationTabs`). '유치원 정보 입력'은 탭 없이 '전체'에서만 보인다(R-인증탭). */
export const OWNER_VERIFICATION_TABS = ['BUSINESS_REGISTRATION_PENDING', 'SUBMITTED', 'REVOKED'] as const;
export type OwnerVerificationTab = (typeof OWNER_VERIFICATION_TABS)[number];

/** 화면의 원장 인증 목록 조건(단계 탭·검색어). 단계 값은 서버 값과 같고 '전체'만 화면에서 쓰는 값이다. */
export type OwnerVerificationListParams = {
  keyword: string;
  status: 'all' | OwnerVerificationTab;
};
