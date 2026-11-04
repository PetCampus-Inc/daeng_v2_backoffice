import { SchoolStatus } from './school-status';

/** 운영 상태 탭 값. '전체'는 화면에서만 쓰는 값이라 서버에는 상태를 보내지 않는다. */
export const KINDERGARTEN_STATUS_FILTERS = ['all', SchoolStatus.ACTIVE, SchoolStatus.CLOSED] as const;
export type KindergartenStatusFilter = (typeof KINDERGARTEN_STATUS_FILTERS)[number];

/** 화면의 유치원 목록 조건(탭·검색어). */
export type KindergartenListParams = { keyword: string; status: KindergartenStatusFilter };
