import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getGetInquiryQueryOptions, getListInquiriesQueryOptions } from '../use-inquiries';
import type { InquirySummaryPage } from '../../type';
import type { InquiryListParams } from '../../type/inquiry-ui';
import {
  inquiryDetailQueryOptions,
  inquiryListQueryOptions,
  toInquiryFilterRequest,
  toInquiryListRequest,
} from './index';

const INITIAL_PARAMS: InquiryListParams = {
  keyword: '',
  status: 'all',
  userType: 'all',
  assignee: 'all',
  sort: 'latest',
};
const PREVIOUS_PAGE: InquirySummaryPage = { items: [], page: 1, size: 20, totalItems: 0, totalPages: 0 };

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: InquiryListParams, page: number) => {
  const request = toInquiryListRequest(params, page);
  return getListInquiriesQueryOptions(request, { query: inquiryListQueryOptions(email, request) });
};

describe('문의 목록 요청 값', () => {
  it("'전체' 조건과 공백뿐인 검색어는 서버에 보내지 않는다", () => {
    expect(toInquiryListRequest({ ...INITIAL_PARAMS, keyword: '  ' }, 1)).toEqual({
      keyword: undefined,
      status: undefined,
      userType: undefined,
      assignee: undefined,
      sort: 'LATEST',
      page: 1,
      size: 20,
    });
  });

  it('상태·유형·정렬은 서버 대문자 값으로, 검색어는 앞뒤 공백을 떼어, 페이지는 그대로(1부터) 보낸다', () => {
    expect(
      toInquiryListRequest(
        { keyword: ' 산책 ', status: 'checking', userType: 'director', assignee: 'all', sort: 'oldest' },
        3
      )
    ).toMatchObject({ keyword: '산책', status: 'CHECKING', userType: 'DIRECTOR', sort: 'OLDEST', page: 3 });
  });

  it.each([
    ['me', 'ME'],
    ['unassigned', 'UNASSIGNED'],
    ['3', '3'],
  ])('담당자 조건 %s 는 서버 값 %s 로 보낸다', (assignee, expected) => {
    expect(toInquiryFilterRequest({ ...INITIAL_PARAMS, assignee })).toMatchObject({ assignee: expected });
  });

  it('이전·다음 문의 요청에는 페이지를 담지 않는다', () => {
    expect(toInquiryFilterRequest(INITIAL_PARAMS)).not.toHaveProperty('page');
  });
});

describe('문의 목록 조회 연속성과 계정 분리', () => {
  it.each(['keyword', 'page', 'account'] as const)('%s 전환은 같은 계정의 이전 결과만 유지한다', async (change) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('ops@test.com', INITIAL_PARAMS, 1);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (value: InquirySummaryPage) => void;
      observer.setOptions({
        ...createOptions(
          change === 'account' ? 'another@test.com' : 'ops@test.com',
          { ...INITIAL_PARAMS, keyword: change === 'keyword' ? '검색' : '' },
          change === 'page' ? 2 : 1
        ),
        queryFn: () =>
          new Promise<InquirySummaryPage>((resolve) => {
            resolveRequest = resolve;
          }),
      });
      expect(observer.getCurrentResult()).toMatchObject(
        change === 'account'
          ? { isPending: true, isPlaceholderData: false, data: undefined }
          : { isPending: false, isFetching: true, isPlaceholderData: true, data: PREVIOUS_PAGE }
      );
      resolveRequest({ ...PREVIOUS_PAGE, totalItems: 1 });
      await vi.waitFor(() =>
        expect(observer.getCurrentResult()).toMatchObject({
          isFetching: false,
          isPlaceholderData: false,
          data: { totalItems: 1 },
        })
      );
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('상세 조회 키는 계정마다 달라 다른 계정의 상세를 재사용하지 않는다', () => {
    const first = getGetInquiryQueryOptions(1043, { query: inquiryDetailQueryOptions('first@test.com', 1043) });
    const second = getGetInquiryQueryOptions(1043, { query: inquiryDetailQueryOptions('second@test.com', 1043) });
    expect(first.queryKey).not.toEqual(second.queryKey);
  });
});
