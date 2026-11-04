import type { UseQueryOptions } from '@tanstack/react-query';
import { getListServiceMembersQueryKey, type ListServiceMembersQueryError } from '../use-members';
import type { ListServiceMembersParams, ServiceMemberPage } from '../../type';
import { MEMBER_FILTER_TYPES, type MemberListParams } from '../../type/service-member-type-ui';

/** 회원 목록 한 페이지 건수. */
const MEMBER_PAGE_SIZE = 20;

/**
 * 화면 조건을 `GET /service-admin/members` 요청 값으로 바꾼다.
 * 탭 값은 서버 대문자 구분으로 바꾸고, 앞뒤 공백만 있는 검색어는 보내지 않는다. 페이지는 1부터 센다.
 */
export const toMemberListRequest = (params: MemberListParams, page: number): ListServiceMembersParams => ({
  type: MEMBER_FILTER_TYPES[params.type],
  keyword: params.keyword.trim() || undefined,
  page,
  size: MEMBER_PAGE_SIZE,
});

/**
 * 생성 훅 `useListServiceMembers`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const memberListQueryOptions = (
  email: string,
  request: ListServiceMembersParams
): Partial<UseQueryOptions<ServiceMemberPage, ListServiceMembersQueryError>> => ({
  queryKey: [...getListServiceMembersQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});
