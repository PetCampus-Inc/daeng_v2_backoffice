import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { getListChangeLogsQueryOptions } from '../use-history';
import type { ChangeLogPage } from '../../type';
import type { HistoryListParams } from '../../type/history-ui';
import { historyListQueryOptions, toHistoryActorOptions, toHistoryListRequest } from './index';

const ALL: HistoryListParams = { period: 'all', from: '', to: '', actor: 'all', targetType: 'all' };
const previousPage: ChangeLogPage = { items: [], page: 1, size: 20, totalItems: 4, totalPages: 1 };

/** 생성 훅이 쓰는 것과 같은 방식으로 조회 옵션을 만든다. */
const createOptions = (email: string) => {
  const request = toHistoryListRequest(ALL, 1, undefined);
  return getListChangeLogsQueryOptions(request, { query: historyListQueryOptions(email, request, true) });
};

describe('변경 이력 요청 값', () => {
  it('페이지는 1부터 그대로 보내고 처음 값은 보내지 않는다', () => {
    expect(toHistoryListRequest(ALL, 1, undefined)).toEqual({
      from: undefined,
      to: undefined,
      actorId: undefined,
      targetType: undefined,
      page: 1,
      size: 20,
    });
  });

  it('대상 종류는 서버 값으로, 행위자는 팀원 ID로 바꿔 보낸다', () => {
    const params: HistoryListParams = {
      period: 'custom',
      from: '2026-10-01',
      to: '2026-10-03',
      actor: 'ops@knockdog.test',
      targetType: 'terms',
    };
    expect(toHistoryListRequest(params, 2, 2)).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-03',
      actorId: 2,
      targetType: 'TERMS_VERSION',
      page: 2,
    });
  });
});

describe('행위자 선택지', () => {
  it('표시명과 직무가 있는 팀원만 나열한다', () => {
    const options = toHistoryActorOptions([
      { id: 1, email: 'admin@knockdog.test', displayName: '김관리', jobRole: 'PM' },
      { id: 6, email: 'new@knockdog.test', displayName: null, jobRole: null },
    ]);
    expect(options).toEqual([{ id: 1, email: 'admin@knockdog.test', label: '김관리 · PM' }]);
  });
});

describe('변경 이력 조회 전환', () => {
  it('계정 변경 시 이전 계정의 결과를 유지하지 않는다', () => {
    const client = new QueryClient();
    const initial = createOptions('first@test.com');
    client.setQueryData(initial.queryKey, previousPage);
    const observer = new QueryObserver(client, { ...initial, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions({
        ...createOptions('second@test.com'),
        queryFn: () => new Promise(() => {}),
      });
      expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true, isPlaceholderData: false });
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
