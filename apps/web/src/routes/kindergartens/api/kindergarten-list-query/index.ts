import type { UseQueryOptions } from '@tanstack/react-query';
import { getListServiceSchoolsQueryKey, type ListServiceSchoolsQueryError } from '../use-kindergartens';
import type { ListServiceSchoolsParams, ServiceSchoolPage } from '../../type';
import type { KindergartenListParams } from '../../type/school-status-ui';

/** 유치원 목록 한 페이지 건수. */
const KINDERGARTEN_PAGE_SIZE = 20;

/**
 * 화면 조건을 `GET /service-admin/schools` 요청 값으로 바꾼다.
 * '전체' 탭은 상태를 보내지 않고, 앞뒤 공백만 있는 검색어는 보내지 않는다. 페이지는 1부터 센다.
 */
export const toKindergartenListRequest = (params: KindergartenListParams, page: number): ListServiceSchoolsParams => ({
  status: params.status === 'all' ? undefined : params.status,
  keyword: params.keyword.trim() || undefined,
  page,
  size: KINDERGARTEN_PAGE_SIZE,
});

/**
 * 생성 훅 `useListServiceSchools`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const kindergartenListQueryOptions = (
  email: string,
  request: ListServiceSchoolsParams
): Partial<UseQueryOptions<ServiceSchoolPage, ListServiceSchoolsQueryError>> => ({
  queryKey: [...getListServiceSchoolsQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});
