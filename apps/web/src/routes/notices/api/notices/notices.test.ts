import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PageResponse } from '@/type/api';
import type { Notice, NoticeListParams } from '../../type/notice';
import { noticesQueryOptions } from './index';

const PREVIOUS_PAGE: PageResponse<Notice> = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 25,
  totalPages: 2,
  hasNext: true,
};
const INITIAL_PARAMS: NoticeListParams = { keyword: '', status: 'all' };

describe('앱 공지 목록 조회 전환', () => {
  it.each([
    { keyword: '', status: 'draft' as const, page: 0 },
    { keyword: '', status: 'published' as const, page: 0 },
    { keyword: '', status: 'unpublished' as const, page: 0 },
    { keyword: '점검', status: 'all' as const, page: 0 },
    { keyword: '', status: 'all' as const, page: 1 },
  ])('미방문 조건 $status/$keyword/$page 조회 중 기존 결과를 유지한다', async ({ page, ...params }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = noticesQueryOptions('ops@test.com', INITIAL_PARAMS, 0);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: PageResponse<Notice>) => void;
      observer.setOptions({
        ...noticesQueryOptions('ops@test.com', params, page),
        queryFn: () =>
          new Promise<PageResponse<Notice>>((resolve) => {
            resolveRequest = resolve;
          }),
      });
      expect(observer.getCurrentResult()).toMatchObject({
        data: PREVIOUS_PAGE,
        isPending: false,
        isFetching: true,
        isPlaceholderData: true,
      });
      const nextPage = { ...PREVIOUS_PAGE, page, totalElements: 1 };
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
    const initial = noticesQueryOptions('first@test.com', INITIAL_PARAMS, 0);
    const observer = new QueryObserver(client, {
      ...initial,
      queryFn: () => new Promise<PageResponse<Notice>>(() => {}),
    });
    expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true, isPlaceholderData: false });
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...noticesQueryOptions('second@test.com', INITIAL_PARAMS, 0),
        queryFn: () => new Promise<PageResponse<Notice>>(() => {}),
      });
      expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true, isPlaceholderData: false });
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('빠른 전환에서 늦게 도착한 이전 응답이 마지막 조건의 결과를 덮어쓰지 않는다', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = noticesQueryOptions('ops@test.com', INITIAL_PARAMS, 0);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    let resolveFirst!: (data: PageResponse<Notice>) => void;
    let resolveLast!: (data: PageResponse<Notice>) => void;
    try {
      observer.setOptions({
        ...noticesQueryOptions('ops@test.com', { keyword: '첫 요청', status: 'all' }, 0),
        queryFn: () =>
          new Promise<PageResponse<Notice>>((resolve) => {
            resolveFirst = resolve;
          }),
      });
      observer.setOptions({
        ...noticesQueryOptions('ops@test.com', { keyword: '마지막 요청', status: 'all' }, 0),
        queryFn: () =>
          new Promise<PageResponse<Notice>>((resolve) => {
            resolveLast = resolve;
          }),
      });
      const lastPage = { ...PREVIOUS_PAGE, totalElements: 2 };
      resolveLast(lastPage);
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(lastPage));
      resolveFirst({ ...PREVIOUS_PAGE, totalElements: 1 });
      await vi.waitFor(() => expect(client.isFetching()).toBe(0));
      expect(observer.getCurrentResult().data).toEqual(lastPage);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
