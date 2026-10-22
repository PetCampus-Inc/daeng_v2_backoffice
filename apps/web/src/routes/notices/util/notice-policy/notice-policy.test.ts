import { describe, expect, it } from 'vitest';
import type { Notice } from '../../type/notice';
import { compareNotices, createNoticeBody, getNoticeText, validateNotice } from './index';

describe('공지 입력 검증', () => {
  it('빈 초안을 저장할 수 있지만 공백뿐인 공지를 게시할 수 없다', () => {
    expect(validateNotice({ title: '', body: createNoticeBody('') })).toMatchObject({
      canSave: true,
      canPublish: false,
    });
    expect(validateNotice({ title: '  ', body: createNoticeBody('내용') }).canPublish).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('\n ') }).canPublish).toBe(false);
  });
  it('제목 50자·본문 5,000자 경계를 검사하고 이모지는 한 글자로 센다', () => {
    expect(validateNotice({ title: '🐶'.repeat(50), body: createNoticeBody('가'.repeat(5000)) })).toMatchObject({
      canSave: true,
      canPublish: true,
      titleCount: 50,
      bodyCount: 5000,
    });
    expect(validateNotice({ title: '가'.repeat(51), body: createNoticeBody('내용') }).canSave).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('가'.repeat(5001)) }).canPublish).toBe(false);
  });
  it('줄바꿈·빈 문단·HTML 글자를 그대로 보존한다', () => {
    const text = '\n<b>굵게</b>\n\n마지막 줄\n';
    expect(getNoticeText(createNoticeBody(text))).toBe(text);
  });
});

describe('공지 앱 노출 순서', () => {
  const makeNotice = (id: number, status: Notice['status'], date: string): Notice => ({
    id,
    status,
    title: '',
    body: createNoticeBody(''),
    createdAt: date,
    publishedAt: status === 'draft' ? null : date,
    updatedAt: '2030-01-01T00:00:00Z',
    revision: 1,
  });
  it('초안을 맨 앞에 두고 각 그룹은 기준 날짜 내림차순, 동률이면 번호 내림차순이다', () => {
    const items = [
      makeNotice(1, 'published', '2026-10-02'),
      makeNotice(2, 'draft', '2026-09-01'),
      makeNotice(3, 'unpublished', '2026-10-01'),
      makeNotice(4, 'draft', '2026-09-01'),
    ];
    expect(items.sort(compareNotices).map((item) => item.id)).toEqual([4, 2, 1, 3]);
  });
  it('게시 해제·재게시·마지막 수정은 최초 게시일에 따른 순서를 바꾸지 않는다', () => {
    const oldNotice = makeNotice(1, 'published', '2026-10-01');
    const newNotice = makeNotice(2, 'published', '2026-10-02');
    expect(compareNotices(oldNotice, newNotice)).toBeGreaterThan(0);
    expect(compareNotices({ ...oldNotice, status: 'unpublished', updatedAt: '2031-01-01' }, newNotice)).toBeGreaterThan(
      0
    );
  });
});
