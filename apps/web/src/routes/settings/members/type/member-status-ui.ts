import type { MemberStatus } from './member-status';

/** 화면에 보이는 계정 상태 이름. */
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  REGISTERED: '등록됨',
  ACTIVE: '활성',
  INACTIVE: '비활성',
  CANCELLED: '등록 취소',
};
