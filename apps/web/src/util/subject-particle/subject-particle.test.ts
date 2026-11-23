import { describe, expect, it } from 'vitest';
import { getSubjectParticle } from './index';

describe('주격 조사 고르기 (이/가)', () => {
  it.each([
    ['이미지', '가'],
    ['사진', '이'],
    ['값', '이'],
  ])('한글은 종성 유무로 고른다: %s → %s', (word, expected) => {
    expect(getSubjectParticle(word)).toBe(expected);
  });

  it.each(['JPG', 'PNG', 'GIF', 'PDF', 'WEBP', 'HEIC', 'AI', 'TXT', 'CSV', 'jpg'])(
    '영문 약어는 철자 소리로 보고 L·M·N·R 외에는 받침이 없다: %s → 가',
    (word) => {
      expect(getSubjectParticle(word)).toBe('가');
    }
  );

  it.each(['DOCM', 'XLSM', 'GIFN', 'PSR', 'SQL', 'docm'])(
    'L·M·N·R로 끝나는 영문 약어는 받침이 있다: %s → 이',
    (word) => {
      expect(getSubjectParticle(word)).toBe('이');
    }
  );

  it.each([
    ['MP0', '이'],
    ['MP1', '이'],
    ['MP2', '가'],
    ['MP3', '이'],
    ['MP4', '가'],
    ['MP5', '가'],
    ['MP6', '이'],
    ['MP7', '이'],
    ['MP8', '이'],
    ['MP9', '가'],
  ])('숫자로 끝나면 읽는 소리로 고른다: %s → %s', (word, expected) => {
    expect(getSubjectParticle(word)).toBe(expected);
  });

  it.each([
    ['JPG·PNG', '가'],
    ['JPG·DOCM', '이'],
    ['사진·', '이'],
    ['사진 ', '이'],
    ['(JPG)', '가'],
    ['(DOCM)', '이'],
    ['JPG·PNG·사진', '이'],
  ])('뒤쪽 기호와 공백은 건너뛰고 마지막 글자를 본다: %s → %s', (word, expected) => {
    expect(getSubjectParticle(word)).toBe(expected);
  });

  it.each(['', '·', ' ', '()'])('글자가 하나도 없으면 가: "%s"', (word) => {
    expect(getSubjectParticle(word)).toBe('가');
  });
});
