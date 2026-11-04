import { describe, expect, it } from 'vitest';
import { createRichContent } from '@/util/rich-content';
import { fromNoticeBodyResponse, toNoticeBodyRequest } from './index';

describe('공지 본문 변환', () => {
  it('글자가 없는 본문은 빈 문자열로 보내고, 빈 문자열은 빈 본문으로 읽는다', () => {
    expect(toNoticeBodyRequest(createRichContent(''))).toBe('');
    expect(fromNoticeBodyResponse('')).toEqual(createRichContent(''));
  });

  it('본문을 보냈다가 다시 읽으면 같은 블록 값이다', () => {
    const body = createRichContent('첫 줄\n<b>둘째 줄</b>');
    expect(fromNoticeBodyResponse(toNoticeBodyRequest(body))).toEqual(body);
  });

  it('JSON이 아닌 글(서버에 이미 있는 마크다운)은 줄마다 문단인 글자 그대로 읽는다', () => {
    expect(fromNoticeBodyResponse('# 제목\n내용')).toEqual(createRichContent('# 제목\n내용'));
    expect(fromNoticeBodyResponse('123')).toEqual(createRichContent('123'));
  });
});
