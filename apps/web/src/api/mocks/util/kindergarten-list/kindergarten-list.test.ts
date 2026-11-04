import { describe, expect, it } from 'vitest';
import type { SchoolStatus } from '@/routes/kindergartens/type';
import { DEFAULT_KINDERGARTENS } from '../../handlers/kindergartens';
import { getKindergartenList, getOwnerName, type MockKindergarten } from './index';

describe('유치원 목록 TC R-유치원목록', () => {
  it.each<[SchoolStatus | undefined, string, string[]]>([
    [undefined, '', ['햇살유치원', '달빛유치원', '별빛유치원', '도담유치원']],
    ['ACTIVE', '', ['햇살유치원', '달빛유치원', '별빛유치원']],
    ['CLOSED', '', ['도담유치원']],
    [undefined, '햇살', ['햇살유치원']],
    [undefined, '박원장', ['달빛유치원']],
    [undefined, '서울', ['햇살유치원', '별빛유치원']],
    [undefined, '성남', ['달빛유치원']],
    ['ACTIVE', '서울', ['햇살유치원', '별빛유치원']],
    ['CLOSED', '서울', []],
    [undefined, '없는말', []],
    // R-유치원목록-12 (OQ-D10 확정): 원장이 없으면 '원장 미연결'로 찾는다
    [undefined, '미연결', ['별빛유치원', '도담유치원']],
    [undefined, '  햇살  ', ['햇살유치원']],
  ])('%s / %s 는 %j를 반환한다', (status, keyword, names) => {
    expect(getKindergartenList(DEFAULT_KINDERGARTENS, { status, keyword }).map((item) => item.name)).toEqual(names);
  });

  it('원장이 없으면 서버처럼 원장 이름을 "원장 미연결"로 내려 준다', () => {
    const items = getKindergartenList(DEFAULT_KINDERGARTENS, { keyword: '' });
    expect(items.map((item) => item.ownerName)).toEqual(['이원장', '박원장', '원장 미연결', '원장 미연결']);
  });
});

describe('원장 이름 규칙 (서버 COALESCE: 보호자 이름, 닉네임, 원장 미연결)', () => {
  it.each([
    [{ guardianName: '이원장', nickname: '별명' }, '이원장'],
    [{ guardianName: null, nickname: '닉네임원장' }, '닉네임원장'],
    [{ guardianName: '', nickname: '닉네임원장' }, '닉네임원장'],
    [{ guardianName: null, nickname: '' }, '원장 미연결'],
    [{ guardianName: null, nickname: null }, '원장 미연결'],
  ])('%j → %s', (owner, expected) => expect(getOwnerName(owner)).toBe(expected));

  it('보호자 이름이 비고 닉네임만 있는 원장도 닉네임으로 검색된다', () => {
    const nicknameOnly: MockKindergarten = {
      ...DEFAULT_KINDERGARTENS[0],
      id: 900,
      name: '닉네임유치원',
      guardianName: null,
      nickname: '닉네임원장',
    };
    const find = (keyword: string) => getKindergartenList([nicknameOnly], { keyword }).map((item) => item.name);
    expect(find('닉네임원장')).toEqual(['닉네임유치원']);
    expect(find('미연결')).toEqual([]);
  });
});
