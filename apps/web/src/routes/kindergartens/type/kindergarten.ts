export const KINDERGARTEN_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type KindergartenStatus = (typeof KINDERGARTEN_STATUSES)[number];

/** 기존 조회 화면의 학교 정보. 관리자 API 확정 전 사용하는 조회 계약. */
export type Kindergarten = {
  id: number;
  name: string;
  ownerName: string | null;
  address: string;
  status: KindergartenStatus;
  activeMembers: number;
  pendingMembers: number;
  businessVerified: boolean;
  createdAt: string;
};

export type KindergartenListParams = {
  keyword: string;
  status: 'all' | KindergartenStatus;
};
