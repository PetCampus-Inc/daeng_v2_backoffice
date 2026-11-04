import { useQueryClient, type Query, type UseQueryOptions } from '@tanstack/react-query';
import {
  getGetNoticeQueryKey,
  getListNoticesQueryKey,
  type GetNoticeQueryError,
  type ListNoticesQueryError,
} from '../use-notices';
import type {
  ListNoticesParams,
  Notice as ServerNotice,
  NoticePage,
  NoticeSummary as ServerNoticeSummary,
} from '../../type';
import {
  NOTICE_STATUS_FROM_SERVER,
  NOTICE_STATUS_REQUEST_VALUES,
  type Notice,
  type NoticeListParams,
  type NoticeSummary,
} from '../../type/notice-ui';
import { fromNoticeBodyResponse } from '../../util/notice-body';

/** 공지 목록 한 페이지 건수(PRD 4.4). */
export const NOTICE_PAGE_SIZE = 20;

/** 공지 변경 요청(저장·게시·게시 해제·삭제)이 진행 중인지 화면 여러 곳에서 함께 보는 키. 계정마다 따로다. */
export const getNoticeChangeMutationKey = (email: string) => ['notices', email, 'change'] as const;

/** 화면 조건과 페이지(1부터)를 `GET /notices` 요청 값으로 바꾼다. 검색어는 앞뒤 공백을 떼고, 공백뿐이면 보내지 않는다. */
export const toNoticeListRequest = (params: NoticeListParams, page: number): ListNoticesParams => ({
  keyword: params.keyword.trim() || undefined,
  status: params.status === 'all' ? undefined : NOTICE_STATUS_REQUEST_VALUES[params.status],
  page,
  size: NOTICE_PAGE_SIZE,
});

/** 서버 공지 목록 한 행을 화면 값으로 바꾼다. 상태만 소문자로 바뀐다. */
export const toNoticeSummary = (notice: ServerNoticeSummary): NoticeSummary => ({
  id: notice.id,
  title: notice.title,
  status: NOTICE_STATUS_FROM_SERVER[notice.status],
  publishedAt: notice.publishedAt,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt,
});

/** 서버 공지 상세를 화면 값으로 바꾼다. 상태는 소문자로, 본문은 블록 값으로 바뀐다. 이미지는 쓰지 않는다. */
export const toNotice = (notice: ServerNotice): Notice => ({
  ...toNoticeSummary(notice),
  body: fromNoticeBodyResponse(notice.body),
  version: notice.version,
});

/** 공지 목록 조회 키인지 본다. 목록 키는 `/notices`로 시작하고, 상세 키는 `/notices/{id}`다. */
const isNoticeListQuery = (query: Query) => query.queryKey[0] === '/notices';

/**
 * 생성 훅 `useListNotices`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다.
 */
export const noticeListQueryOptions = (
  email: string,
  request: ListNoticesParams
): Partial<UseQueryOptions<NoticePage, ListNoticesQueryError>> => ({
  queryKey: [...getListNoticesQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
});

/** 생성 훅 `useGetNotice`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 상세를 쓰지 않도록 키 끝에 이메일을 붙이고, 없는 공지(404)는 다시 시도하지 않는다. */
export const noticeDetailQueryOptions = (
  email: string,
  id: number
): Partial<UseQueryOptions<ServerNotice, GetNoticeQueryError>> => ({
  queryKey: [...getGetNoticeQueryKey(id), email],
  retry: false,
});

/** 공지 목록·상세를 모두 다시 읽게 한다. 다른 팀원이 먼저 바꾼 것이 드러났을 때 쓴다. */
export const useInvalidateNotices = () => {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/notices') });
};

/**
 * 저장·게시·재게시·게시 해제 생성 훅에 넘기는 공통 옵션.
 * 성공 응답으로 상세를 바꾸고, 목록을 다시 읽게 한다.
 */
export const useNoticeChangeOptions = (email: string) => {
  const queryClient = useQueryClient();
  return {
    mutation: {
      mutationKey: getNoticeChangeMutationKey(email),
      onSuccess: (notice: ServerNotice) => {
        queryClient.setQueryData([...getGetNoticeQueryKey(notice.id), email], notice);
        void queryClient.invalidateQueries({ predicate: isNoticeListQuery });
      },
    },
  };
};

/** 초안 삭제 생성 훅에 넘기는 옵션. 성공하면 상세를 지우고 목록을 다시 읽게 한다. */
export const useNoticeDeleteOptions = (email: string) => {
  const queryClient = useQueryClient();
  return {
    mutation: {
      mutationKey: getNoticeChangeMutationKey(email),
      onSuccess: (_data: void, variables: { id: number }) => {
        queryClient.removeQueries({ queryKey: [...getGetNoticeQueryKey(variables.id), email] });
        void queryClient.invalidateQueries({ predicate: isNoticeListQuery });
      },
    },
  };
};
