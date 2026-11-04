import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createRichContent } from '@/util/rich-content';
import type { TermsVersion, TermsVersionSummary } from '../../type';
import { fromTermBodyResponse } from '../../util/term-body';
import { getGetTermsVersionQueryOptions, getListTermsVersionsQueryOptions } from '../use-terms';
import { termDetailQueryOptions, termListQueryOptions, toServerTermKind, toTerm, toTermSummary } from './index';

const SERVER_SUMMARY: TermsVersionSummary = {
  id: 7,
  kind: 'PRIVACY_POLICY',
  effectiveDate: '2026-11-10',
  publishStatus: 'PUBLISHED',
  effectiveStatus: 'SCHEDULED',
  publishedAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
};

describe('서버 약관 값을 화면 값으로 바꾸기', () => {
  it('서버 id가 화면의 버전 번호가 되고, 종류·상태는 소문자가 된다', () => {
    expect(toTermSummary(SERVER_SUMMARY)).toEqual({
      kind: 'privacy',
      version: 7,
      status: 'published',
      effectiveDate: '2026-11-10',
      publishedAt: '2026-10-07T01:00:00.000Z',
      updatedAt: '2026-10-07T01:00:00.000Z',
    });
  });

  it('비어 있는 시행일은 빈 문자열이 된다', () => {
    expect(toTermSummary({ ...SERVER_SUMMARY, effectiveDate: null, publishStatus: 'DRAFT' })).toMatchObject({
      effectiveDate: '',
      status: 'draft',
    });
  });

  it('서버 version(동시 수정 값)이 화면의 revision이 되고, 본문은 블록 값이 된다', () => {
    const server: TermsVersion = { ...SERVER_SUMMARY, content: '제1조', announcedDate: '2026-10-07', version: 3 };
    const term = toTerm(server);
    expect(term.version).toBe(7);
    expect(term.revision).toBe(3);
    expect(term.body).toEqual(fromTermBodyResponse('제1조'));
    expect(term.body).toEqual(createRichContent('제1조'));
  });

  it('화면 종류를 서버 종류로 바꾼다', () => {
    expect(['service', 'privacy', 'location'].map((kind) => toServerTermKind(kind as 'service'))).toEqual([
      'SERVICE_TERMS',
      'PRIVACY_POLICY',
      'LOCATION_TERMS',
    ]);
  });
});

describe('약관 조회 계정 분리', () => {
  it('목록·상세 조회 키 끝에 로그인 이메일을 붙인다', () => {
    const list = getListTermsVersionsQueryOptions('SERVICE_TERMS', {
      query: termListQueryOptions('ops@test.com', 'service'),
    });
    const detail = getGetTermsVersionQueryOptions(4, { query: termDetailQueryOptions('ops@test.com', 4) });
    expect(list.queryKey).toEqual(['/terms/SERVICE_TERMS/versions', 'ops@test.com']);
    expect(detail.queryKey).toEqual(['/term-versions/4', 'ops@test.com']);
  });

  it('다른 계정으로 바뀌면 이전 계정의 결과를 표시하지 않는다', () => {
    const client = new QueryClient();
    const first = getListTermsVersionsQueryOptions('SERVICE_TERMS', {
      query: termListQueryOptions('first@test.com', 'service'),
    });
    // 캐시에는 서버 응답이 들어 있고, 화면은 조회 옵션의 `select`로 화면 값을 읽는다.
    client.setQueryData<TermsVersionSummary[]>(first.queryKey, [SERVER_SUMMARY]);
    const observer = new QueryObserver(client, { ...first, queryFn: () => new Promise<never>(() => {}) });
    expect(observer.getCurrentResult().data).toEqual([toTermSummary(SERVER_SUMMARY)]);
    const second = getListTermsVersionsQueryOptions('SERVICE_TERMS', {
      query: termListQueryOptions('second@test.com', 'service'),
    });
    observer.setOptions({ ...second, queryFn: () => new Promise<never>(() => {}) });
    expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isPending: true });
    client.clear();
  });
});
