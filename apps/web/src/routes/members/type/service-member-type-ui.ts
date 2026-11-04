import { ServiceMemberType } from './service-member-type';

/** 회원 유형 탭 값. 화면 주소(`?type=`)에는 소문자로 남긴다. */
export const MEMBER_FILTERS = ['all', 'guardian', 'owner', 'withdrawn'] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

/** 탭 값에 맞는 서버 회원 구분(대문자). '전체'는 구분을 보내지 않는다. */
export const MEMBER_FILTER_TYPES: Record<MemberFilter, ServiceMemberType | undefined> = {
  all: undefined,
  guardian: ServiceMemberType.GUARDIAN,
  owner: ServiceMemberType.OWNER,
  withdrawn: ServiceMemberType.WITHDRAWN,
};

/** 화면의 회원 목록 조건(탭·검색어). */
export type MemberListParams = { keyword: string; type: MemberFilter };
