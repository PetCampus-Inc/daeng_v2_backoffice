import { describe, expect, it } from 'vitest';
import type { SortParameter } from '@/type/sort-parameter';
import type { UserType } from '@/type/user-type';
import { DEFAULT_IDEAS } from '../../handlers/ideas';
import { getIdeaList } from './index';

describe('제안 목록 TC R-제안검색·R-제안정렬', () => {
  it.each<[string, UserType | undefined, number[]]>([
    ['산책 코스', undefined, [350]],
    ['DAILY', undefined, [349]],
    ['홍길동', undefined, [350, 346]],
    ['', 'DIRECTOR', [349, 347]],
    ['', 'GUARDIAN', [350, 348, 346]],
    ['좋겠어요', 'DIRECTOR', [347]],
    ['없는말', undefined, []],
    // 이름·이메일·내용 어느 곳에서든 일부만 맞아도 찾고, 대소문자는 가리지 않는다.
    ['이원', undefined, [349, 347]],
    ['choi@', undefined, [348]],
    ['DIRECTOR.LEE@EXAMPLE.COM', undefined, [349, 347]],
    ['example.com', undefined, [350, 349, 348, 347, 346]],
    ['example.com', 'GUARDIAN', [350, 348, 346]],
    ['  hong@  ', undefined, [350, 346]],
  ])('검색어 %j / 유형 %s 는 %j를 반환한다', (keyword, userType, ids) => {
    expect(getIdeaList(DEFAULT_IDEAS, { keyword, userType }).map((item) => item.id)).toEqual(ids);
  });

  it.each<[SortParameter | undefined, number[]]>([
    [undefined, [350, 349, 348, 347, 346]],
    ['LATEST', [350, 349, 348, 347, 346]],
    // #349와 #348은 제출일시가 같아 두 방향 모두 번호 큰 #349가 먼저다.
    ['OLDEST', [346, 347, 349, 348, 350]],
  ])('정렬 %s 은 %j 순서다', (sort, ids) => {
    expect(getIdeaList(DEFAULT_IDEAS, { keyword: '', sort }).map((item) => item.id)).toEqual(ids);
  });

  it('이름·이메일이 빈 제안도 내용으로 찾고, 없는 말은 0건이다', () => {
    const anonymous = [{ ...DEFAULT_IDEAS[0], id: 1, user: { type: 'GUARDIAN' as const, name: '', email: '' } }];
    expect(getIdeaList(anonymous, { keyword: '산책 코스' })).toHaveLength(1);
    expect(getIdeaList(anonymous, { keyword: '없는말' })).toHaveLength(0);
  });
});
