import type { VerificationStatus } from '@/type/overview';

/** 단계 탭(service-admin.html `applicationTabs`). '유치원 정보 입력'은 탭 없이 '전체'에서만 보인다(R-인증탭). */
export const OWNER_VERIFICATION_TABS = ['BUSINESS_REGISTRATION_PENDING', 'SUBMITTED', 'REVOKED'] as const;
export type OwnerVerificationTab = (typeof OWNER_VERIFICATION_TABS)[number];

/** 정렬 드롭다운 값. 처음 값은 최신 순이다(S-인증-010). */
export const OWNER_VERIFICATION_SORTS = ['latest', 'oldest'] as const;
export type OwnerVerificationSort = (typeof OWNER_VERIFICATION_SORTS)[number];

export const OWNER_VERIFICATION_SORT_LABELS: Record<OwnerVerificationSort, string> = {
  latest: '최신 순',
  oldest: '오래된 순',
};

/**
 * 원장 인증 한 건. 관리자 API 확정 전 mock과 공유하는 계약으로, 기존 서버(`service-admin.js` `/verifications`) 값을 따른다.
 * 연락처·사업자번호는 서버가 가려서 준다(11-회원.md R-가림). 값이 없으면 null.
 */
export type OwnerVerification = {
  id: number;
  userId: string;
  /** 회원 이름(보호자 이름 → 닉네임 → 대표자 이름) */
  userName: string;
  kindergartenName: string;
  kindergartenAddress: string;
  status: VerificationStatus;
  /** ISO 날짜·시간. 유치원 정보 입력 단계는 아직 제출 전이라 없을 수 있다 */
  submittedAt: string | null;
  /** 원장 역할이 생긴 시각. 해지됨 건은 해지 전 값 */
  ownerGrantedAt: string | null;
  businessRegistrationNumber: string | null;
  representativeName: string;
  representativePhone: string | null;
};

export type OwnerVerificationListParams = {
  keyword: string;
  status: 'all' | OwnerVerificationTab;
  sort: OwnerVerificationSort;
};
