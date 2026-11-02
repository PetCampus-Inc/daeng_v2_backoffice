import { describe, expect, it } from 'vitest';
import { canSubmitReply, getReplyLengthError } from '.';

describe('R-답변저장 [답변 저장] 활성', () => {
  it.each([
    ['01 빈 값', '', false, false],
    ['02 공백만', '   ', false, false],
    ['03 줄바꿈만', '\n\n', false, false],
    ['04 1자', '네', false, true],
    ['05 500자', 'a'.repeat(500), false, true],
    ['06 501자', 'a'.repeat(501), false, false],
    ['07 저장 요청 중', '확인해 보겠습니다', true, false],
  ])('R-답변저장-%s', (_label, value, isPending, expected) => expect(canSubmitReply(value, isPending)).toBe(expected));
});

describe('R-글자수 문의 답변(최대 500)', () => {
  it('R-글자수-01 500자는 안내가 없다', () => expect(getReplyLengthError('a'.repeat(500))).toBeNull());
  it('R-글자수-02 501자는 1자를 줄이라고 안내한다', () =>
    expect(getReplyLengthError('a'.repeat(501))).toBe('답변은 500자까지 입력할 수 있습니다. 1자를 줄여 주세요.'));
  it('R-글자수-03 520자는 20자를 줄이라고 안내한다', () =>
    expect(getReplyLengthError('a'.repeat(520))).toBe('답변은 500자까지 입력할 수 있습니다. 20자를 줄여 주세요.'));
});
