import { describe, expect, it } from 'vitest';
import {
  getTermErrorGuide,
  TERM_BODY_INVALID_MESSAGE,
  TERM_CONFLICT_MESSAGE,
  TERM_MISSING_MESSAGE,
  TERM_NOT_DRAFT_MESSAGE,
  TERM_WITHDRAW_BLOCKED_MESSAGE,
} from './index';

const NOW = new Date('2026-10-07T10:00:00+09:00');

describe('약관 요청 거절 안내', () => {
  it.each([
    [400, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    [400, 'TERMS_EFFECTIVE_DATE_IN_PAST', '과거 날짜는 시행일로 지정할 수 없습니다.'],
    [
      400,
      'TERMS_EFFECTIVE_DATE_TOO_SOON',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    [
      400,
      'TERMS_EFFECTIVE_DATE_DUPLICATED',
      '같은 시행일로 공개된 버전이 이미 있습니다. 다른 날짜를 고르거나 그 버전을 철회해 주세요.',
    ],
    [400, 'TERMS_EFFECTIVE_DATE_REQUIRED', '공개하려면 시행일을 입력해 주세요.'],
    [400, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST', '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.'],
  ])('%i %s 는 시행일 칸 안내를 고른다', (status, code, description) => {
    expect(getTermErrorGuide(status, code, NOW)).toEqual({
      description,
      isMissing: false,
      field: 'date',
    });
  });

  it('400 VALIDATION_FAILED는 시행일 오류가 아니라 본문 안내로 구분한다', () => {
    expect(getTermErrorGuide(400, 'VALIDATION_FAILED', NOW)).toEqual({
      description: TERM_BODY_INVALID_MESSAGE,
      isMissing: false,
      field: 'body',
    });
  });

  it.each([
    [404, 'TERMS_VERSION_NOT_FOUND', TERM_MISSING_MESSAGE, true],
    [409, 'TERMS_VERSION_CONFLICT', TERM_CONFLICT_MESSAGE, false],
    [409, 'TERMS_VERSION_NOT_DRAFT', TERM_NOT_DRAFT_MESSAGE, false],
    [409, 'TERMS_WITHDRAW_NOT_ALLOWED', TERM_WITHDRAW_BLOCKED_MESSAGE, false],
  ])('%i %s 는 맞는 안내를 고른다', (status, code, description, isMissing) => {
    expect(getTermErrorGuide(status, code, NOW)).toEqual({
      description,
      isMissing,
    });
  });

  it('500·네트워크 오류와 알 수 없는 400은 안내 없이 일시적 오류로 넘긴다', () => {
    expect(getTermErrorGuide(500, undefined)).toBeNull();
    expect(getTermErrorGuide(undefined, undefined)).toBeNull();
    expect(getTermErrorGuide(400, 'SOMETHING_ELSE')).toBeNull();
  });
});
