import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PageResponse } from '@/type/api';
import type { Kindergarten } from '../../type/kindergarten';
import { kindergartensQueryOptions } from './index';

const previousPage: PageResponse<Kindergarten> = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 4,
  totalPages: 1,
  hasNext: false,
};

describe('유치원 목록 조회 전환', () => {
  it.each([
    { keyword: '', status: 'ACTIVE' as const, page: 0 },
    { keyword: '', status: 'CLOSED' as const, page: 0 },
    { keyword: '서울', status: 'all' as const, page: 0 },
    { keyword: '', status: 'all' as const, page: 1 },
  ])('미방문 조건 $status/$keyword/$page 조회 중 기존 결과를 유지하고 완료 후 교체한다', async (params) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = kindergartensQueryOptions('viewer@test.com', { keyword: '', status: 'all' }, 0);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: PageResponse<Kindergarten>) => void;
      const request = new Promise<PageResponse<Kindergarten>>((resolve) => {
        resolveRequest = resolve;
      });
      observer.setOptions({
        ...kindergartensQueryOptions('viewer@test.com', params, params.page),
        queryFn: () => request,
      });
      expect(observer.getCurrentResult()).toMatchObject({
        data: previousPage,
        isPending: false,
        isFetching: true,
        isPlaceholderData: true,
      });
      const nextPage = { ...previousPage, totalElements: 1 };
      resolveRequest(nextPage);
      await vi.waitFor(() => {
        expect(observer.getCurrentResult()).toMatchObject({
          data: nextPage,
          isFetching: false,
          isPlaceholderData: false,
        });
      });
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('계정 변경 시 이전 계정의 결과를 유지하지 않는다', () => {
    const client = new QueryClient();
    const initial = kindergartensQueryOptions('first@test.com', { keyword: '', status: 'all' }, 0);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...kindergartensQueryOptions('second@test.com', { keyword: '', status: 'all' }, 0),
        queryFn: () => new Promise(() => {}),
      });
      expect(observer.getCurrentResult()).toMatchObject({
        data: undefined,
        isPending: true,
        isPlaceholderData: false,
      });
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
