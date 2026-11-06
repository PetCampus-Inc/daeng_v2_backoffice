import { describe, expect, it } from 'vitest';
import { NoticeStatus } from '@/routes/notices/type';
import { createDefaultNotices } from '../../handlers/notices';
import { getNoticeList, parseNoticeId, parseNoticeListQuery, type MockNotice } from './index';

const DEFAULT_NOTICES = createDefaultNotices();
const idsOf = (keyword = '', status?: NoticeStatus) =>
  getNoticeList(DEFAULT_NOTICES, { keyword, status }).map((notice) => notice.id);

/** 정렬 규칙만 보려고 제목·본문 없이 상태와 날짜만 채운 공지를 만든다. */
const makeNotice = (id: number, status: NoticeStatus, date: string, createdAt = date): MockNotice => ({
  id,
  status,
  title: '',
  body: { schemaVersion: 1, blocks: [] },
  createdAt,
  publishedAt: status === NoticeStatus.DRAFT ? null : date,
  updatedAt: '2030-01-01T00:00:00Z',
  version: 1,
});

describe('공지 목록 TC R-공지정렬', () => {
  it('공지-기본은 #14, #13, #12, #11, #10 순서다', () => {
    expect(idsOf()).toEqual([14, 13, 12, 11, 10]);
  });

  it('초안을 맨 앞에 두고 각 그룹은 기준 날짜 내림차순, 동률이면 번호 내림차순이다', () => {
    const items = [
      makeNotice(1, NoticeStatus.PUBLISHED, '2026-10-02T00:00:00Z'),
      makeNotice(2, NoticeStatus.DRAFT, '2026-09-01T00:00:00Z'),
      makeNotice(3, NoticeStatus.UNPUBLISHED, '2026-10-01T00:00:00Z'),
      makeNotice(4, NoticeStatus.DRAFT, '2026-09-01T00:00:00Z'),
    ];
    expect(getNoticeList(items, { keyword: '' }).map((item) => item.id)).toEqual([4, 2, 1, 3]);
  });

  it('게시 해제·재게시·마지막 수정은 최초 게시일에 따른 순서를 바꾸지 않는다', () => {
    const oldNotice = makeNotice(1, NoticeStatus.UNPUBLISHED, '2026-10-01T00:00:00Z');
    const newNotice = makeNotice(2, NoticeStatus.PUBLISHED, '2026-10-02T00:00:00Z');
    expect(getNoticeList([oldNotice, newNotice], { keyword: '' }).map((item) => item.id)).toEqual([2, 1]);
  });
});

describe('공지 목록 TC S-공지-003 검색·상태', () => {
  it.each<[string, NoticeStatus | undefined, number[]]>([
    ['점검', undefined, [12]],
    ['test', undefined, [10]],
    ['', NoticeStatus.DRAFT, [14, 13]],
    ['', NoticeStatus.PUBLISHED, [12, 10]],
    ['', NoticeStatus.UNPUBLISHED, [11]],
    ['없는말', undefined, []],
  ])('검색어 %j 상태 %s 는 %j를 반환한다', (keyword, status, ids) => {
    expect(idsOf(keyword, status)).toEqual(ids);
  });
});

describe('공지 목록 요청 검증', () => {
  const parse = (query: string) => parseNoticeListQuery(new URLSearchParams(query));

  it('조건을 보내지 않으면 처음 값(1페이지, 20건)이다', () => {
    expect(parse('')).toMatchObject({ filter: { keyword: '', status: undefined }, page: 1, size: 20 });
  });

  it('검색어는 50자까지만 받고 51자는 400이다', () => {
    expect(parse(`keyword=${'가'.repeat(50)}`).issues).toBeUndefined();
    expect(parse(`keyword=${'가'.repeat(51)}`).issues).toEqual([
      { field: 'keyword', reason: '50자 이하로 입력해 주세요.' },
    ]);
  });

  it.each(['page=0', 'page=-1', 'page=1.5', 'page=', 'size=0', 'size=101', 'status=draft'])(
    '잘못된 값 %s 는 400이다',
    (query) => {
      expect(parse(query).issues).toHaveLength(1);
    }
  );
});

describe('공지 번호 규칙', () => {
  it.each<[string, number | undefined]>([
    ['1', 1],
    ['14', 14],
    ['0', undefined],
    ['-1', undefined],
    ['1e3', undefined],
    ['0x10', undefined],
    ['9007199254740993', undefined],
    ['abc', undefined],
  ])('%j 는 %j 이다', (rawId, expected) => {
    expect(parseNoticeId(rawId)).toBe(expected);
  });
});
