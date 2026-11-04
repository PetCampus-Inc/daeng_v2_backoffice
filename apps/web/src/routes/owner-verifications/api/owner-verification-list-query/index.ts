import type { UseQueryOptions } from '@tanstack/react-query';
import {
  getListServiceVerificationsQueryKey,
  type ListServiceVerificationsQueryError,
} from '../use-owner-verifications';
import type { ListServiceVerificationsParams, ServiceVerificationPage } from '../../type';
import type { OwnerVerificationListParams } from '../../type/owner-verification-ui';

/** 원장 인증 목록 한 페이지 건수. */
const OWNER_VERIFICATION_PAGE_SIZE = 20;

/**
 * 화면 조건을 `GET /service-admin/verifications` 요청 값으로 바꾼다.
 * 단계 값은 서버와 같아 그대로 보내고 '전체'는 보내지 않는다. 앞뒤 공백만 있는 검색어도 보내지 않는다. 페이지는 1부터 센다.
 */
export const toOwnerVerificationListRequest = (
  params: OwnerVerificationListParams,
  page: number
): ListServiceVerificationsParams => ({
  status: params.status === 'all' ? undefined : params.status,
  keyword: params.keyword.trim() || undefined,
  page,
  size: OWNER_VERIFICATION_PAGE_SIZE,
});

/**
 * 생성 훅 `useListServiceVerifications`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const verificationListQueryOptions = (
  email: string,
  request: ListServiceVerificationsParams
): Partial<UseQueryOptions<ServiceVerificationPage, ListServiceVerificationsQueryError>> => ({
  queryKey: [...getListServiceVerificationsQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});
