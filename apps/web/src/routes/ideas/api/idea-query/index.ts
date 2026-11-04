import type { UseQueryOptions } from '@tanstack/react-query';
import {
  getGetIdeaQueryKey,
  getListIdeasQueryKey,
  type GetIdeaQueryError,
  type ListIdeasQueryError,
} from '../use-ideas';
import type { Idea as ServerIdea, IdeaPage, ListIdeasParams } from '../../type';
import {
  IDEA_SORT_REQUEST_VALUES,
  IDEA_USER_TYPE_FROM_SERVER,
  IDEA_USER_TYPE_REQUEST_VALUES,
  type Idea,
  type IdeaListParams,
} from '../../type/idea-ui';

/** 제안 목록 한 페이지 건수. */
const IDEA_PAGE_SIZE = 20;

/**
 * 화면 조건을 `GET /ideas` 요청 값으로 바꾼다.
 * 사용자 유형·정렬은 서버 대문자 값으로 바꾸고 '전체'는 보내지 않는다. 앞뒤 공백만 있는 검색어도 보내지 않는다.
 * 페이지는 1부터 센다.
 */
export const toIdeaListRequest = (params: IdeaListParams, page: number): ListIdeasParams => ({
  keyword: params.keyword.trim() || undefined,
  userType: params.userType === 'all' ? undefined : IDEA_USER_TYPE_REQUEST_VALUES[params.userType],
  sort: IDEA_SORT_REQUEST_VALUES[params.sort],
  page,
  size: IDEA_PAGE_SIZE,
});

/** 서버 제안을 화면 제안으로 바꾼다. 사용자 유형만 소문자로 바뀐다. */
export const toIdea = (idea: ServerIdea): Idea => ({
  ...idea,
  user: { ...idea.user, type: IDEA_USER_TYPE_FROM_SERVER[idea.user.type] },
});

/**
 * 생성 훅 `useListIdeas`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const ideaListQueryOptions = (
  email: string,
  request: ListIdeasParams
): Partial<UseQueryOptions<IdeaPage, ListIdeasQueryError>> => ({
  queryKey: [...getListIdeasQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});

/**
 * 생성 훅 `useGetIdea`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 상세를 쓰지 않도록 조회 키 끝에 이메일을 붙이고,
 * 없는 제안(404)은 다시 시도하지 않는다.
 */
export const ideaDetailQueryOptions = (
  email: string,
  id: number
): Partial<UseQueryOptions<ServerIdea, GetIdeaQueryError>> => ({
  queryKey: [...getGetIdeaQueryKey(id), email],
  retry: false,
});
