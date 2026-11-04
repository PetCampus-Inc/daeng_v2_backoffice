import { describe, expect, it } from 'vitest';
import {
  getNoticeErrorGuide,
  NOTICE_PUBLISHED_MESSAGE,
  NOTICE_EMPTY_MESSAGE,
  NOTICE_TOO_LONG_MESSAGE,
  NOTICE_NOT_DRAFT_MESSAGE,
  NOTICE_NOT_PUBLISHED_MESSAGE,
  NOTICE_MISSING_MESSAGE,
  NOTICE_CONFLICT_MESSAGE,
} from './index';

describe('공지 저장·게시 거절 안내', () => {
  it.each([
    [400, 'NOTICE_CONTENT_REQUIRED', NOTICE_EMPTY_MESSAGE, false],
    [400, 'VALIDATION_FAILED', NOTICE_TOO_LONG_MESSAGE, false],
    [404, 'NOTICE_NOT_FOUND', NOTICE_MISSING_MESSAGE, true],
    [409, 'NOTICE_VERSION_CONFLICT', NOTICE_CONFLICT_MESSAGE, false],
    [409, 'NOTICE_NOT_DRAFT', NOTICE_NOT_DRAFT_MESSAGE, false],
    [409, 'NOTICE_NOT_PUBLISHED', NOTICE_NOT_PUBLISHED_MESSAGE, false],
    [409, 'NOTICE_ALREADY_PUBLISHED', NOTICE_PUBLISHED_MESSAGE, false],
  ])('%i %s 는 맞는 안내를 고른다', (status, code, description, isMissing) => {
    expect(getNoticeErrorGuide(status, code)).toEqual({
      description,
      isMissing,
    });
  });

  it('500·네트워크 오류는 안내 없이 일시적 오류로 넘긴다', () => {
    expect(getNoticeErrorGuide(500, undefined)).toBeNull();
    expect(getNoticeErrorGuide(undefined, undefined)).toBeNull();
  });
});
