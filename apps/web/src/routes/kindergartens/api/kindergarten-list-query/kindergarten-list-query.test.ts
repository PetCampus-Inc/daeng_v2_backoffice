import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getListServiceSchoolsQueryOptions } from '../use-kindergartens';
import type { ServiceSchoolPage } from '../../type';
import type { KindergartenListParams } from '../../type/school-status-ui';
import { kindergartenListQueryOptions, toKindergartenListRequest } from './index';

const previousPage: ServiceSchoolPage = {
  items: [],
  page: 1,
  size: 20,
  totalItems: 4,
  totalPages: 1,
};

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: KindergartenListParams, page: number) => {
  const request = toKindergartenListRequest(params, page);
  return getListServiceSchoolsQueryOptions(request, { query: kindergartenListQueryOptions(email, request) });
};

describe('유치원 목록 요청 값', () => {
  it('전체 탭은 상태를 보내지 않고 검색어 앞뒤 공백을 뗀다', () => {
    expect(toKindergartenListRequest({ keyword: '  서울 ', status: 'all' }, 2)).toEqual({
      status: undefined,
      keyword: '서울',
      page: 2,
      size: 20,
    });
  });

  it('공백뿐인 검색어는 보내지 않고 상태 탭은 그대로 보낸다', () => {
    expect(toKindergartenListRequest({ keyword: '   ', status: 'CLOSED' }, 1)).toMatchObject({
      status: 'CLOSED',
      keyword: undefined,
    });
  });
});

describe('유치원 목록 조회 전환', () => {
  it.each([
    { keyword: '', status: 'ACTIVE' as const, page: 1 },
    { keyword: '', status: 'CLOSED' as const, page: 1 },
    { keyword: '서울', status: 'all' as const, page: 1 },
    { keyword: '', status: 'all' as const, page: 2 },
  ])('미방문 조건 $status/$keyword/$page 조회 중 기존 결과를 유지하고 완료 후 교체한다', async (params) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('viewer@test.com', { keyword: '', status: 'all' }, 1);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: ServiceSchoolPage) => void;
      const request = new Promise<ServiceSchoolPage>((resolve) => {
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
    const initial = createOptions('first@test.com', { keyword: '', status: 'all' }, 1);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...createOptions('second@test.com', { keyword: '', status: 'all' }, 1),
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
