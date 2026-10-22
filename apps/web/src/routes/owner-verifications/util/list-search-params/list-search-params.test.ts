import { describe, expect, it } from 'vitest';
import { parsePositiveInteger } from './index';

describe('주소의 고른 건·페이지 값 해석(S-인증-017)', () => {
  it.each([
    ['205', 205],
    ['1', 1],
  ])('10진수 %s는 %i로 읽는다', (value, expected) => {
    expect(parsePositiveInteger(value)).toBe(expected);
  });

  it.each(['1e3', '0x10', ' ', '', ' 205', '205 ', '20 5', '0', '-1', '007', '2.0', '205abc', '9007199254740993'])(
    '이상한 값 %j는 읽지 않는다',
    (value) => {
      expect(parsePositiveInteger(value)).toBeNull();
    }
  );
});
