import { useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  getGetAdjacentInquiriesQueryKey,
  getGetInquiryQueryKey,
  getListInquiriesQueryKey,
  getListInquiryAssigneesQueryKey,
  type GetAdjacentInquiriesQueryError,
  type GetInquiryQueryError,
  type ListInquiriesQueryError,
  type ListInquiryAssigneesQueryError,
} from '../use-inquiries';
import type {
  GetAdjacentInquiriesParams,
  InquiryAdjacent,
  InquiryAssignee,
  InquiryDetail as ServerInquiryDetail,
  InquirySummary as ServerInquirySummary,
  InquirySummaryPage,
  ListInquiriesParams,
} from '../../type';
import {
  INQUIRY_MESSAGE_AUTHOR_FROM_SERVER,
  INQUIRY_SORT_REQUEST_VALUES,
  INQUIRY_STATUS_FROM_SERVER,
  INQUIRY_STATUS_REQUEST_VALUES,
  INQUIRY_USER_TYPE_FROM_SERVER,
  INQUIRY_USER_TYPE_REQUEST_VALUES,
  type InquiryDetail,
  type InquiryListParams,
  type InquirySummary,
} from '../../type/inquiry-ui';

/** 문의 목록 한 페이지 건수(PRD 4.4). */
export const INQUIRY_PAGE_SIZE = 20;

/** 화면 담당자 조건을 서버 값으로 바꾼다. `all`은 보내지 않고, `me`·`unassigned`는 대문자로, 팀원 번호는 그대로 보낸다. */
const toAssigneeRequest = (assignee: string) => {
  if (assignee === 'all') return undefined;
  if (assignee === 'me') return 'ME';
  if (assignee === 'unassigned') return 'UNASSIGNED';
  return assignee;
};

/**
 * 화면 조건을 서버 조건(검색어·상태·사용자 유형·담당자·정렬)으로 바꾼다. 이전·다음 문의 요청이 그대로 쓴다.
 * '전체'는 보내지 않고, 앞뒤 공백만 있는 검색어도 보내지 않는다.
 */
export const toInquiryFilterRequest = (params: InquiryListParams): GetAdjacentInquiriesParams => ({
  keyword: params.keyword.trim() || undefined,
  status: params.status === 'all' ? undefined : INQUIRY_STATUS_REQUEST_VALUES[params.status],
  userType: params.userType === 'all' ? undefined : INQUIRY_USER_TYPE_REQUEST_VALUES[params.userType],
  assignee: toAssigneeRequest(params.assignee),
  sort: INQUIRY_SORT_REQUEST_VALUES[params.sort],
});

/** 화면 조건과 페이지(1부터)를 `GET /inquiries` 요청 값으로 바꾼다. */
export const toInquiryListRequest = (params: InquiryListParams, page: number): ListInquiriesParams => ({
  ...toInquiryFilterRequest(params),
  page,
  size: INQUIRY_PAGE_SIZE,
});

/** 서버 문의 목록 한 행을 화면 값으로 바꾼다. 상태와 사용자 유형만 소문자로 바뀐다. */
export const toInquirySummary = (inquiry: ServerInquirySummary): InquirySummary => ({
  ...inquiry,
  status: INQUIRY_STATUS_FROM_SERVER[inquiry.status],
  user: { ...inquiry.user, type: INQUIRY_USER_TYPE_FROM_SERVER[inquiry.user.type] },
});

/** 서버 문의 상세를 화면 값으로 바꾼다. 상태·사용자 유형·메시지 작성자만 소문자로 바뀐다. */
export const toInquiryDetail = (inquiry: ServerInquiryDetail): InquiryDetail => ({
  ...toInquirySummary(inquiry),
  createdAt: inquiry.createdAt,
  messages: inquiry.messages.map((message) => ({
    ...message,
    author: INQUIRY_MESSAGE_AUTHOR_FROM_SERVER[message.author],
  })),
});

/**
 * 생성 훅 `useListInquiries`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const inquiryListQueryOptions = (
  email: string,
  request: ListInquiriesParams
): Partial<UseQueryOptions<InquirySummaryPage, ListInquiriesQueryError>> => ({
  queryKey: [...getListInquiriesQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});

/** 생성 훅 `useListInquiryAssignees`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 선택지를 쓰지 않도록 키 끝에 이메일을 붙인다. */
export const inquiryAssigneesQueryOptions = (
  email: string
): Partial<UseQueryOptions<InquiryAssignee[], ListInquiryAssigneesQueryError>> => ({
  queryKey: [...getListInquiryAssigneesQueryKey(), email],
});

/** 생성 훅 `useGetInquiry`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 상세를 쓰지 않도록 키 끝에 이메일을 붙이고, 없는 문의(404)는 다시 시도하지 않는다. */
export const inquiryDetailQueryOptions = (
  email: string,
  id: number
): Partial<UseQueryOptions<ServerInquiryDetail, GetInquiryQueryError>> => ({
  queryKey: [...getGetInquiryQueryKey(id), email],
  retry: false,
});

/** 생성 훅 `useGetAdjacentInquiries`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 결과를 쓰지 않도록 키 끝에 이메일을 붙인다. */
export const inquiryAdjacentQueryOptions = (
  email: string,
  id: number,
  request: GetAdjacentInquiriesParams
): Partial<UseQueryOptions<InquiryAdjacent, GetAdjacentInquiriesQueryError>> => ({
  queryKey: [...getGetAdjacentInquiriesQueryKey(id, request), email],
});

/**
 * 맡기·담당 해제·해제 취소·답변 저장 생성 훅에 넘기는 공통 옵션.
 * 성공 응답으로 상세를 바꾸고, 목록과 이전·다음 문의를 다시 읽게 한다.
 */
export const useInquiryChangeOptions = (email: string) => {
  const queryClient = useQueryClient();
  return {
    mutation: {
      onSuccess: (inquiry: ServerInquiryDetail) => {
        queryClient.setQueryData([...getGetInquiryQueryKey(inquiry.id), email], inquiry);
        void queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
        void queryClient.invalidateQueries({
          predicate: (query) => String(query.queryKey[0]).endsWith('/adjacent'),
        });
      },
    },
  };
};
