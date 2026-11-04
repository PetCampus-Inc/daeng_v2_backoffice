import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getGetIdeaQueryOptions, getListIdeasQueryOptions } from '../use-ideas';
import type { IdeaPage } from '../../type';
import type { IdeaListParams } from '../../type/idea-ui';
import { ideaDetailQueryOptions, ideaListQueryOptions, toIdea, toIdeaListRequest } from './index';

const INITIAL_PARAMS: IdeaListParams = { keyword: '', userType: 'all', sort: 'latest' };
const PREVIOUS_PAGE: IdeaPage = { items: [], page: 1, size: 20, totalItems: 0, totalPages: 0 };

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string, params: IdeaListParams, page: number) => {
  const request = toIdeaListRequest(params, page);
  return getListIdeasQueryOptions(request, { query: ideaListQueryOptions(email, request) });
};

describe('제안 목록 요청 값', () => {
  it("'전체' 유형과 공백뿐인 검색어는 서버에 보내지 않는다", () => {
    expect(toIdeaListRequest({ keyword: '  ', userType: 'all', sort: 'latest' }, 1)).toEqual({
      keyword: undefined,
      userType: undefined,
      sort: 'LATEST',
      page: 1,
      size: 20,
    });
  });

  it('유형·정렬은 서버 대문자 값으로, 검색어는 앞뒤 공백을 떼어, 페이지는 그대로 보낸다', () => {
    expect(toIdeaListRequest({ keyword: ' 산책 ', userType: 'director', sort: 'oldest' }, 3)).toMatchObject({
      keyword: '산책',
      userType: 'DIRECTOR',
      sort: 'OLDEST',
      page: 3,
    });
  });

  it('서버 제안의 사용자 유형을 화면 값(소문자)으로 바꾼다', () => {
    const user = { type: 'GUARDIAN' as const, name: '홍길동', email: 'hong@example.com' };
    expect(toIdea({ id: 1, content: '내용', user, submittedAt: '2026-10-07T00:00:00Z' }).user).toEqual({
      ...user,
      type: 'guardian',
    });
  });
});

describe('제안 조회 연속성과 계정 분리', () => {
  it.each(['keyword', 'page', 'account'] as const)('%s 전환은 같은 계정의 이전 결과만 유지한다', async (change) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = createOptions('ops@test.com', INITIAL_PARAMS, 1);
    client.setQueryData(initial.queryKey, PREVIOUS_PAGE);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      let resolveRequest!: (value: IdeaPage) => void;
      observer.setOptions({
        ...createOptions(
          change === 'account' ? 'another@test.com' : 'ops@test.com',
          { ...INITIAL_PARAMS, keyword: change === 'keyword' ? '검색' : '' },
          change === 'page' ? 2 : 1
        ),
        queryFn: () =>
          new Promise<IdeaPage>((resolve) => {
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
    const first = getGetIdeaQueryOptions(350, { query: ideaDetailQueryOptions('first@test.com', 350) });
    const second = getGetIdeaQueryOptions(350, { query: ideaDetailQueryOptions('second@test.com', 350) });
    expect(first.queryKey).not.toEqual(second.queryKey);
  });
});
