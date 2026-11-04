import { SortParameter } from '@/type/sort-parameter';
import { UserType } from '@/type/user-type';
import type { Idea as ServerIdea } from './idea';

/** 사용자 유형 값. 화면 주소(`?userType=`)에는 소문자로 남기고, 서버에는 대문자로 보낸다. */
export const IDEA_USER_TYPES = ['guardian', 'director'] as const;
export type IdeaUserType = (typeof IDEA_USER_TYPES)[number];
export const IDEA_USER_TYPE_LABELS = { guardian: '보호자', director: '원장' } as const;
/** 화면 사용자 유형에 맞는 서버 값(대문자). */
export const IDEA_USER_TYPE_REQUEST_VALUES: Record<IdeaUserType, UserType> = {
  guardian: UserType.GUARDIAN,
  director: UserType.DIRECTOR,
};
/** 서버 사용자 유형에 맞는 화면 값(소문자). */
export const IDEA_USER_TYPE_FROM_SERVER: Record<UserType, IdeaUserType> = {
  [UserType.GUARDIAN]: 'guardian',
  [UserType.DIRECTOR]: 'director',
};

/** 정렬 값. 화면 주소(`?sort=`)에는 소문자로 남기고, 서버에는 대문자로 보낸다. */
export const IDEA_SORTS = ['latest', 'oldest'] as const;
export type IdeaSort = (typeof IDEA_SORTS)[number];
/** 화면 정렬에 맞는 서버 값(대문자). */
export const IDEA_SORT_REQUEST_VALUES: Record<IdeaSort, SortParameter> = {
  latest: SortParameter.LATEST,
  oldest: SortParameter.OLDEST,
};

/** 화면이 쓰는 제안. 서버 응답과 사용자 유형 글자(소문자)만 다르다. */
export type Idea = Omit<ServerIdea, 'user'> & { user: Omit<ServerIdea['user'], 'type'> & { type: IdeaUserType } };

/** 화면의 제안 목록 조건(검색어·사용자 유형·정렬). '전체'만 화면에서 쓰는 값이다. */
export type IdeaListParams = {
  keyword: string;
  userType: IdeaUserType | 'all';
  sort: IdeaSort;
};
