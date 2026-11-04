import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getListNoticesQueryOptions } from '../use-notices';
import type { NoticePage } from '../../type';
import type { NoticeListParams } from '../../type/notice-ui';
import { noticeListQueryOptions, toNoticeListRequest } from './index';

const INITIAL_PARAMS: NoticeListParams = { keyword: '', status: 'all' };
const PREVIOUS_PAGE: NoticePage = { items: [], page: 1, size: 20, totalItems: 25, totalPages: 2 };

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: NoticeListParams, page: number) => {
  const request = toNoticeListRequest(params, page);
  return getListNoticesQueryOptions(request, { query: noticeListQueryOptions(email, request) });
};

describe('공지 목록 요청 값', () => {
  it("'전체' 상태와 공백뿐인 검색어는 서버에 보내지 않는다", () => {
    expect(toNoticeListRequest({ keyword: '   ', status: 'all' }, 1)).toEqual({
      keyword: undefined,
      status: undefined,
      page: 1,
      size: 20,
    });
  });

  it('상태는 서버 대문자 값으로, 검색어는 앞뒤 공백을 떼어, 페이지는 그대로(1부터) 보낸다', () => {
    expect(toNoticeListRequest({ keyword: ' 점검 ', status: 'unpublished' }, 3)).toEqual({
      keyword: '점검',
      status: 'UNPUBLISHED',
      page: 3,
      size: 20,
    });
  });
});

describe('공지 목록 조회 연속성과 계정 분리', () => {
  it.each(['keyword', 'status', 'page'] as const)('%s 전환은 같은 계정의 이전 결과를 유지한다', async (change) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('ops@test.com', INITIAL_PARAMS, 1);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (value: NoticePage) => void;
      observer.setOptions({
        ...createOptions(
          'ops@test.com',
          {
            keyword: change === 'keyword' ? '점검' : '',
            status: change === 'status' ? 'draft' : 'all',
          },
          change === 'page' ? 2 : 1
        ),
        queryFn: () =>
          new Promise<NoticePage>((resolve) => {
            resolveRequest = resolve;
          }),
      });
      expect(observer.getCurrentResult()).toMatchObject({
        data: PREVIOUS_PAGE,
        isPending: false,
        isFetching: true,
        isPlaceholderData: true,
      });
      const nextPage = { ...PREVIOUS_PAGE, totalItems: 1 };
      resolveRequest(nextPage);
      await vi.waitFor(() =>
        expect(observer.getCurrentResult()).toMatchObject({
          data: nextPage,
          isFetching: false,
          isPlaceholderData: false,
        })
      );
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('최초 조회와 계정 변경에는 이전 계정의 결과를 표시하지 않는다', () => {
    const client = new QueryClient();
    const initial = createOptions('first@test.com', INITIAL_PARAMS, 1);
    const observer = new QueryObserver(client, { ...initial, queryFn: () => new Promise<NoticePage>(() => {}) });
    expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true, isPlaceholderData: false });
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...createOptions('second@test.com', INITIAL_PARAMS, 1),
        queryFn: () => new Promise<NoticePage>(() => {}),
      });
      expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true, isPlaceholderData: false });
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('빠른 전환에서 늦게 도착한 이전 응답이 마지막 조건의 결과를 덮어쓰지 않는다', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('ops@test.com', INITIAL_PARAMS, 1);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    let resolveFirst!: (data: NoticePage) => void;
    let resolveLast!: (data: NoticePage) => void;
    try {
      observer.setOptions({
        ...createOptions('ops@test.com', { keyword: '첫 요청', status: 'all' }, 1),
        queryFn: () =>
          new Promise<NoticePage>((resolve) => {
            resolveFirst = resolve;
          }),
      });
      observer.setOptions({
        ...createOptions('ops@test.com', { keyword: '마지막 요청', status: 'all' }, 1),
        queryFn: () =>
          new Promise<NoticePage>((resolve) => {
            resolveLast = resolve;
          }),
      });
      const lastPage = { ...PREVIOUS_PAGE, totalItems: 2 };
      resolveLast(lastPage);
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(lastPage));
      resolveFirst({ ...PREVIOUS_PAGE, totalItems: 1 });
      await vi.waitFor(() => expect(client.isFetching()).toBe(0));
      expect(observer.getCurrentResult().data).toEqual(lastPage);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
