import { describe, expect, it } from 'vitest';
import { createDefaultInquiries } from '../../handlers/inquiries';
import {
  getAdjacentInquiryIds,
  getInquiryList,
  parseInquiryId,
  parseInquiryListQuery,
  type MockInquiryFilter,
} from './index';

const ME = 2;
const DEFAULT_INQUIRIES = createDefaultInquiries();
const filterOf = (filter: Partial<MockInquiryFilter>): MockInquiryFilter => ({
  keyword: '',
  sort: 'LATEST',
  ...filter,
});
const idsOf = (filter: Partial<MockInquiryFilter>) =>
  getInquiryList(DEFAULT_INQUIRIES, filterOf(filter)).map((inquiry) => inquiry.id);

describe('문의 목록 TC R-문의정렬', () => {
  it('최신순과 오래된 순은 동률이면 번호 큰 것이 먼저다', () => {
    expect(idsOf({})).toEqual([1041, 1042, 1044, 1043, 1045, 1050, 1046, 1047, 1048, 1049]);
    expect(idsOf({ sort: 'OLDEST' })).toEqual([1049, 1048, 1047, 1046, 1050, 1045, 1044, 1043, 1042, 1041]);
  });
});

describe('문의 목록 TC R-문의검색', () => {
  it.each<[string, number[]]>([
    ['산책', [1041]],
    ['이원장', [1042, 1045, 1050, 1049]],
    ['DIRECTOR.LEE', [1042, 1045, 1050, 1049]],
    ['1044', [1044]],
    ['푸시 알림', [1043]],
    ['추가로 궁금한', [1050]],
    ['영수증은 메일로', [1044]],
    ['없는말', []],
    ['  산책  ', [1041]],
  ])('검색어 %j 는 %j를 반환한다', (keyword, ids) => {
    expect(idsOf({ keyword })).toEqual(ids);
  });
});

describe('문의 목록 TC R-담당자필터', () => {
  it.each<[string, Partial<MockInquiryFilter>, number[]]>([
    ['전체', {}, [1041, 1042, 1044, 1043, 1045, 1050, 1046, 1047, 1048, 1049]],
    ['내 담당', { assignee: ME }, [1044, 1043, 1050, 1048]],
    ['미배정', { assignee: 'UNASSIGNED' }, [1041, 1042, 1046, 1049]],
    ['이담당 · FE', { assignee: 3 }, [1045]],
    ['정비활 · BE (비활성)', { assignee: 5 }, [1047]],
  ])('%s', (_label, filter, ids) => {
    expect(idsOf(filter)).toEqual(ids);
  });
});

describe('문의 목록 TC R-이전다음', () => {
  it.each<[string, number, Partial<MockInquiryFilter>, number | null, number | null]>([
    ['01 최신순', 1043, {}, 1044, 1045],
    ['02 첫 문의', 1041, {}, null, 1042],
    ['03 마지막 문의', 1049, {}, 1048, null],
    ['04 내 담당', 1043, { assignee: ME }, 1044, 1050],
    ['05 오래된 순', 1043, { sort: 'OLDEST' }, 1044, 1042],
    ['06 검색 1044', 1044, { keyword: '1044' }, null, null],
    ['조건에 없는 문의는 앞뒤가 모두 없다', 1041, { assignee: ME }, null, null],
  ])('R-이전다음-%s', (_label, id, filter, prevId, nextId) => {
    expect(getAdjacentInquiryIds(DEFAULT_INQUIRIES, id, filterOf(filter))).toEqual({ prevId, nextId });
  });
});

describe('서버 쿼리 검증', () => {
  const parse = (query: string, options = { hasPage: true }) =>
    parseInquiryListQuery(new URLSearchParams(query), ME, options);

  it('ME는 요청한 팀원 번호로 바뀌고 정렬·페이지·크기는 기본값이 있다', () => {
    expect(parse('assignee=ME')).toMatchObject({ filter: { assignee: ME, sort: 'LATEST' }, page: 1, size: 20 });
  });

  it('검색어는 앞뒤 공백을 뗀 뒤 100자까지 허용하고 101자는 400이다', () => {
    expect(parse(`keyword=${encodeURIComponent(` ${'가'.repeat(100)} `)}`)).not.toHaveProperty('issues');
    expect(parse(`keyword=${'가'.repeat(101)}`)).toMatchObject({ issues: [{ field: 'keyword' }] });
  });

  it.each(['0', '1e3', '0x10', '-1', '03', 'abc', ' 3', 'me', 'ops@knockdog.test'])(
    '담당자 %j 는 400이다',
    (assignee) => {
      expect(parse(`assignee=${encodeURIComponent(assignee)}`)).toMatchObject({ issues: [{ field: 'assignee' }] });
    }
  );

  it('상태·사용자 유형·정렬의 소문자 값은 400이다', () => {
    expect(parse('status=waiting&userType=guardian&sort=latest')).toMatchObject({
      issues: [{ field: 'status' }, { field: 'userType' }, { field: 'sort' }],
    });
  });

  it('page는 1 이상, size는 1~100의 정수만 허용하고 이전·다음 문의는 읽지 않는다', () => {
    expect(parse('page=0&size=101')).toMatchObject({ issues: [{ field: 'page' }, { field: 'size' }] });
    expect(parse('page=2&size=100')).toMatchObject({ page: 2, size: 100 });
    expect(parse('page=0', { hasPage: false })).toMatchObject({ page: 1 });
  });

  it.each([
    ['1043', 1043],
    ['0', undefined],
    ['-1', undefined],
    ['1.5', undefined],
    ['abc', undefined],
    ['9007199254740993', undefined],
  ])('문의 번호 %j 는 %j 로 읽는다', (rawId, expected) => {
    expect(parseInquiryId(rawId)).toBe(expected);
  });
});
