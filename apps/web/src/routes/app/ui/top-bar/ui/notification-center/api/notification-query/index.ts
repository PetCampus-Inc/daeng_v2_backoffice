import { infiniteQueryOptions, type UseQueryOptions } from '@tanstack/react-query';
import {
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
  listNotifications,
  type GetUnreadNotificationCountQueryError,
} from '../use-notifications';
import type { NotificationPage, UnreadNotificationCount } from '../../type';
import { NOTIFICATION_PAGE_SIZE } from '../../type/notification-ui';

/** 알림 조회 공통 설정. 60초마다 갱신하고 30초 안에는 캐시를 쓴다. 실패는 다시 시도 버튼으로 복구한다. */
const POLLING_OPTIONS = { retry: false, staleTime: 30_000, refetchInterval: 60_000 } as const;

/**
 * 알림 목록의 조회 키. 단일 페이지 키와 구분하고, 끝에 로그인 이메일을 붙여
 * 계정이 바뀌면 이전 계정의 알림을 보여 주지 않는다.
 */
export const notificationListQueryKey = (email: string) =>
  [...getListNotificationsQueryKey(), 'infinite', email] as const;

/** 안 읽은 알림 수의 조회 키. 끝에 로그인 이메일을 붙인다. */
export const unreadCountQueryKey = (email: string) => [...getGetUnreadNotificationCountQueryKey(), email] as const;

/** 다음에 받을 페이지 번호. 마지막 페이지면 `undefined`라서 더 이어 붙이지 않는다. */
export const getNextNotificationPage = (lastPage: NotificationPage) =>
  lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;

/**
 * 알림 목록 무한 스크롤 조회 옵션. 생성 함수 `listNotifications`로 페이지를 1부터 20건씩 받는다.
 * 생성 훅은 한 페이지씩이라 `useInfiniteQuery`에 넘긴다.
 */
export const notificationListQueryOptions = (email: string) =>
  infiniteQueryOptions({
    queryKey: notificationListQueryKey(email),
    queryFn: ({ pageParam, signal }) =>
      listNotifications({ page: pageParam, size: NOTIFICATION_PAGE_SIZE }, undefined, signal),
    initialPageParam: 1,
    getNextPageParam: getNextNotificationPage,
    ...POLLING_OPTIONS,
  });

/** 생성 훅 `useGetUnreadNotificationCount`에 넘기는 조회 옵션. 배지 숫자는 팝오버를 열기 전에도 필요하다. */
export const unreadCountQueryOptions = (
  email: string
): Partial<UseQueryOptions<UnreadNotificationCount, GetUnreadNotificationCountQueryError>> => ({
  queryKey: unreadCountQueryKey(email),
  ...POLLING_OPTIONS,
});
