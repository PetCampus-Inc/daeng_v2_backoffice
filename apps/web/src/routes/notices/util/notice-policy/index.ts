import { getRichText as getNoticeText } from '@/util/rich-content';
import type { NoticeInput } from '../../type/notice-ui';

export { createRichContent as createNoticeBody, getRichText as getNoticeText } from '@/util/rich-content';

/** 서버가 이보다 긴 검색어를 400으로 거절하므로 공지 검색창에서 막는다. 공용 값(100자)과 달리 이 화면은 50자다. */
export const NOTICE_KEYWORD_MAX_LENGTH = 50;

/**
 * 제목·본문 입력을 검사한다. 제목 글자 수는 서버와 같은 내부 길이(UTF-16, `.length`)로 센다.
 * 본문 글자 수는 본문 형식(OQ-P4)이 정해질 때까지 기존 방식(글자 하나씩)으로 센다.
 */
export function validateNotice(input: NoticeInput) {
  const titleCount = input.title.length;
  const bodyCount = [...getNoticeText(input.body)].length;
  return {
    titleCount,
    bodyCount,
    canSave: titleCount <= 50 && bodyCount <= 5000,
    canPublish:
      titleCount <= 50 &&
      bodyCount <= 5000 &&
      input.title.trim().length > 0 &&
      getNoticeText(input.body).trim().length > 0,
  };
}
