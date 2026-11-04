import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getListServiceMembersQueryOptions } from '../use-members';
import type { ServiceMemberPage } from '../../type';
import type { MemberListParams } from '../../type/service-member-type-ui';
import { memberListQueryOptions, toMemberListRequest } from './index';

const previousPage: ServiceMemberPage = {
  items: [],
  page: 1,
  size: 20,
  totalItems: 4,
  totalPages: 1,
};

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: MemberListParams, page: number) => {
  const request = toMemberListRequest(params, page);
  return getListServiceMembersQueryOptions(request, { query: memberListQueryOptions(email, request) });
};

describe('회원 목록 조회 전환', () => {
  it.each([
    { keyword: '', type: 'guardian' as const, page: 1 },
    { keyword: '', type: 'withdrawn' as const, page: 1 },
    { keyword: '서울', type: 'all' as const, page: 1 },
    { keyword: '', type: 'all' as const, page: 2 },
  ])('미방문 조건 $type/$keyword/$page 조회 중 기존 결과를 유지하고 완료 후 교체한다', async (params) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('viewer@test.com', { keyword: '', type: 'all' }, 1);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: ServiceMemberPage) => void;
      const request = new Promise<ServiceMemberPage>((resolve) => {
        resolveRequest = resolve;
      });
      observer.setOptions({
        ...createOptions('viewer@test.com', params, params.page),
        queryFn: () => request,
      });
      expect(observer.getCurrentResult()).toMatchObject({
        data: previousPage,
        isPending: false,
        isFetching: true,
        isPlaceholderData: true,
      });
      const nextPage = { ...previousPage, totalItems: 1 };
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
    const initial = createOptions('first@test.com', { keyword: '', type: 'all' }, 1);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...createOptions('second@test.com', { keyword: '', type: 'all' }, 1),
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
