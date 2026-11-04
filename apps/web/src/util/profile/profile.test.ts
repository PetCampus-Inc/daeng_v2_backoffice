import { describe, expect, it } from 'vitest';

import { countCharacters, isValidDisplayName } from './index';

describe('countCharacters', () => {
  it('서버와 같은 내부 길이(UTF-16)로 센다', () => {
    expect(countCharacters('김관리')).toBe(3);
    expect(countCharacters('😀')).toBe(2);
    expect(countCharacters('👨‍👩‍👧‍👦')).toBe(11);
  });
});

describe('isValidDisplayName', () => {
  it('1자와 10자는 허용하고 빈 값·공백·11자는 거부한다', () => {
    expect(isValidDisplayName('김')).toBe(true);
    expect(isValidDisplayName('일이삼사오육칠팔구십')).toBe(true);
    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('   ')).toBe(false);
    expect(isValidDisplayName('일이삼사오육칠팔구십일')).toBe(false);
  });

  it('이모지는 내부 길이로 세어 5개(10)는 허용하고 6개(12)는 거부한다', () => {
    expect(isValidDisplayName('😀'.repeat(5))).toBe(true);
    expect(isValidDisplayName('😀'.repeat(6))).toBe(false);
  });
});
