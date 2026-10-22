import { describe, expect, it } from 'vitest';

import { countCharacters, isValidDisplayName } from './index';

describe('countCharacters', () => {
  it('한글과 조합형 이모지를 화면에 보이는 글자 단위로 센다', () => {
    expect(countCharacters('김관리')).toBe(3);
    expect(countCharacters('👨‍👩‍👧‍👦')).toBe(1);
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
});
