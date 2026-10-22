export const MEMBER_FILTERS = ['all', 'guardian', 'owner', 'withdrawn'] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];
export const MEMBER_JOINED_PERIODS = ['all', '7d', '30d'] as const;
export type MemberJoinedPeriod = (typeof MEMBER_JOINED_PERIODS)[number];
export type MemberListParams = { keyword: string; type: MemberFilter; joinedWithin?: MemberJoinedPeriod };

/** 조회 응답의 연락처는 서버에서 가린 값만 받는다. 원문 필드는 화면 계약에 두지 않는다. */
export type Member = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'WITHDRAWN';
  petCount: number;
  isGuardian: boolean;
  isOwner: boolean;
  schoolName: string | null;
  createdAt: string;
};
