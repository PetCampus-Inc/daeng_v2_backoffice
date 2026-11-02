import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PageResponse } from '@/type/api';
import type { InquiryListParams, InquirySummary } from '../../type/inquiry';
import { inquiriesQueryOptions } from './index';

const INITIAL_PARAMS: InquiryListParams = {
  keyword: '',
  status: 'all',
  userType: 'all',
  assignee: 'all',
  sort: 'latest',
};
const PREVIOUS_PAGE: PageResponse<InquirySummary> = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
};

describe('inquiries 목록 조회 연속성과 계정 분리', () => {
  it.each(['keyword', 'page', 'account'] as const)('%s 전환은 같은 계정의 이전 결과만 유지한다', async (change) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = inquiriesQueryOptions('ops@test.com', INITIAL_PARAMS, 0);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (value: PageResponse<InquirySummary>) => void;
      observer.setOptions({
        ...inquiriesQueryOptions(
          change === 'account' ? 'another@test.com' : 'ops@test.com',
          { ...INITIAL_PARAMS, keyword: change === 'keyword' ? '검색' : '' },
          change === 'page' ? 1 : 0
        ),
        queryFn: () =>
          new Promise<PageResponse<InquirySummary>>((resolve) => {
            resolveRequest = resolve;
          }),
      });
      expect(observer.getCurrentResult()).toMatchObject(
        change === 'account'
          ? { isPending: true, isPlaceholderData: false, data: undefined }
          : { isPending: false, isFetching: true, isPlaceholderData: true, data: PREVIOUS_PAGE }
      );
      resolveRequest({ ...PREVIOUS_PAGE, totalElements: 1 });
      await vi.waitFor(() =>
        expect(observer.getCurrentResult()).toMatchObject({
          isFetching: false,
          isPlaceholderData: false,
          data: { totalElements: 1 },
        })
      );
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
