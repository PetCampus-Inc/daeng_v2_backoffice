import { describe, expect, it } from 'vitest';
import { createNoticeBody, getNoticeText, validateNotice } from './index';

describe('공지 입력 검증', () => {
  it('빈 초안을 저장할 수 있지만 공백뿐인 공지를 게시할 수 없다', () => {
    expect(validateNotice({ title: '', body: createNoticeBody('') })).toMatchObject({
      canSave: true,
      canPublish: false,
    });
    expect(validateNotice({ title: '  ', body: createNoticeBody('내용') }).canPublish).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('\n ') }).canPublish).toBe(false);
  });
  it('제목 50자·본문 5,000자 경계를 검사한다', () => {
    expect(validateNotice({ title: '가'.repeat(50), body: createNoticeBody('가'.repeat(5000)) })).toMatchObject({
      canSave: true,
      canPublish: true,
      titleCount: 50,
      bodyCount: 5000,
    });
    expect(validateNotice({ title: '가'.repeat(51), body: createNoticeBody('내용') }).canSave).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('가'.repeat(5001)) }).canPublish).toBe(false);
  });
  it('제목 글자 수는 서버와 같은 내부 길이(UTF-16)로 센다. 이모지는 2자다', () => {
    expect(validateNotice({ title: '😀'.repeat(25), body: createNoticeBody('내용') })).toMatchObject({
      titleCount: 50,
      canSave: true,
    });
    expect(validateNotice({ title: '😀'.repeat(26), body: createNoticeBody('내용') })).toMatchObject({
      titleCount: 52,
      canSave: false,
      canPublish: false,
    });
  });
  it('줄바꿈·빈 문단·HTML 글자를 그대로 보존한다', () => {
    const text = '\n<b>굵게</b>\n\n마지막 줄\n';
    expect(getNoticeText(createNoticeBody(text))).toBe(text);
  });
});
