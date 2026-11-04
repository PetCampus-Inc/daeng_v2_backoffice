import type { VerificationStatus } from '@/type/verification-status';

/** 화면에 보이는 원장 인증 단계 이름(service-admin.html `verificationLabels`). */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  KINDERGARTEN_INFO_COMPLETED: '유치원 정보 입력',
  BUSINESS_REGISTRATION_PENDING: '사업자번호 대기',
  SUBMITTED: '인증 완료',
  REVOKED: '해지됨',
};
