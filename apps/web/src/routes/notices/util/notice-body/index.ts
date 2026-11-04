import type { RichContent } from '@/type/rich-content';
import { createRichContent, isRichContent, sameRichContent } from '@/util/rich-content';

/**
 * 공지 본문을 서버 문자열로 바꾸는 단 하나의 지점.
 * 서버는 본문을 마크다운 문자열로만 받는다. 지금은 화면의 블록 값을 JSON 문자열 그대로 보내고(OQ-P4),
 * 서버가 JSON 수용 여부를 답하면 이 파일의 두 함수만 교체한다. 글자가 하나도 없는 본문은 빈 문자열로 보낸다.
 */
export function toNoticeBodyRequest(body: RichContent): string {
  return sameRichContent(body, createRichContent('')) ? '' : JSON.stringify(body);
}

/**
 * 서버 본문 문자열을 화면의 블록 값으로 바꾼다. JSON으로 읽히지 않는 글(빈 초안, 서버에 이미 있는 마크다운)은
 * 줄마다 문단인 글자 그대로 보여 준다. 마크다운을 해석하지는 않는다.
 */
export function fromNoticeBodyResponse(text: string): RichContent {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRichContent(parsed)) return parsed;
  } catch {
    /* JSON이 아니면 글자 그대로 보여 준다. */
  }
  return createRichContent(text);
}
