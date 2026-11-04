import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getListServiceVerificationsQueryOptions } from '../use-owner-verifications';
import type { ServiceVerificationPage } from '../../type';
import type { OwnerVerificationListParams } from '../../type/owner-verification-ui';
import { verificationListQueryOptions, toOwnerVerificationListRequest } from './index';

const previousPage: ServiceVerificationPage = {
  items: [],
  page: 1,
  size: 20,
  totalItems: 4,
  totalPages: 1,
};

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: OwnerVerificationListParams, page: number) => {
  const request = toOwnerVerificationListRequest(params, page);
  return getListServiceVerificationsQueryOptions(request, {
    query: verificationListQueryOptions(email, request),
  });
};

describe('원장 인증 목록 요청 값', () => {
  it("'전체' 탭과 공백뿐인 검색어는 서버에 보내지 않는다", () => {
    expect(toOwnerVerificationListRequest({ keyword: '  ', status: 'all' }, 1)).toEqual({
      status: undefined,
      keyword: undefined,
      page: 1,
      size: 20,
    });
  });

  it('단계 값은 그대로, 검색어는 앞뒤 공백을 떼어 보낸다', () => {
    expect(toOwnerVerificationListRequest({ keyword: ' 햇살 ', status: 'SUBMITTED' }, 2)).toMatchObject({
      status: 'SUBMITTED',
      keyword: '햇살',
      page: 2,
    });
  });
});

describe('원장 인증 목록 조회 전환', () => {
  it.each([
    { keyword: '', status: 'SUBMITTED' as const, page: 1 },
    { keyword: '햇살', status: 'all' as const, page: 1 },
    { keyword: '', status: 'all' as const, page: 2 },
  ])('미방문 조건 $status/$keyword/$page 조회 중 기존 결과를 유지하고 완료 후 교체한다', async (params) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('viewer@test.com', { keyword: '', status: 'all' }, 1);
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (data: ServiceVerificationPage) => void;
      const request = new Promise<ServiceVerificationPage>((resolve) => {
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
