import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PageResponse } from '@/type/api';
import type { Member } from '../../type/member';
import { membersQueryOptions } from './index';

const previousPage: PageResponse<Member> = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 4,
  totalPages: 1,
  hasNext: false,
};

describe('회원 목록 조회 전환', () => {
  it.each([
    { keyword: '', type: 'guardian' as const, page: 0 },
    { keyword: '', type: 'withdrawn' as const, page: 0 },
    { keyword: '', type: 'all' as const, joinedWithin: '7d' as const, page: 0 },
    { keyword: '서울', type: 'all' as const, page: 0 },
    { keyword: '', type: 'all' as const, page: 1 },
  ])('미방문 조건 $type/$keyword/$page 조회 중 기존 결과를 유지하고 완료 후 교체한다', async (params) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = membersQueryOptions('viewer@test.com', { keyword: '', type: 'all' }, 0);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: PageResponse<Member>) => void;
      const request = new Promise<PageResponse<Member>>((resolve) => {
        resolveRequest = resolve;
      });
      observer.setOptions({
        ...membersQueryOptions('viewer@test.com', params, params.page),
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
    const initial = membersQueryOptions('first@test.com', { keyword: '', type: 'all' }, 0);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...membersQueryOptions('second@test.com', { keyword: '', type: 'all' }, 0),
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
