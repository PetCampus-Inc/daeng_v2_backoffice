import { describe, expect, it } from 'vitest';
import { DEFAULT_TERMS } from '@/api/mocks/handlers/terms';
import {
  compareTerms,
  displayTermDate,
  fillTermDates,
  getInitialTermBody,
  getTermStatus,
  parseTermDate,
  validateEffectiveDate,
} from './index';
const NOW = new Date('2026-10-07T10:00:00+09:00');
const SERVICE = DEFAULT_TERMS.filter((item) => item.kind === 'service');
const PRIVACY = DEFAULT_TERMS.filter((item) => item.kind === 'privacy');

describe('R-약관시행일: 형식 → 과거 → 7일 → 최근 공개 시행일', () => {
  it.each([
    ['01', 'privacy', '2026. 10. 14.', null],
    [
      '02',
      'privacy',
      '2026. 10. 13.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    [
      '03',
      'privacy',
      '2026. 10. 07.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    ['04', 'privacy', '2026. 10. 06.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
    ['05', 'privacy', '2026. 13. 01.', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['06', 'privacy', 'abc', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['07', 'privacy', '2026. 02. 30.', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['09', 'service', '2026. 10. 20.', '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.'],
    ['10', 'service', '2026. 10. 15.', '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.'],
    ['11', 'service', '2026. 10. 21.', null],
    ['12', 'service', '2026. 10. 01.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
    [
      '13',
      'service',
      '2026. 10. 10.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    ['14', 'location', '2026. 10. 14.', null],
  ])('R-약관시행일-%s', (_id, kind, value, expected) => {
    expect(
      validateEffectiveDate(
        value!,
        DEFAULT_TERMS.filter((item) => item.kind === kind),
        NOW
      )
    ).toBe(expected);
  });
  it.each([
    ['2026-10-07T23:30:00+09:00', '2026. 10. 14.', null],
    [
      '2026-10-08T00:10:00+09:00',
      '2026. 10. 14.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 15. 이후로 골라 주세요.',
    ],
    ['2026-10-08T00:10:00+09:00', '2026. 10. 07.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
  ])('KST 날짜 경계 %s', (now, value, expected) =>
    expect(validateEffectiveDate(value!, PRIVACY, new Date(now!))).toBe(expected)
  );
  it('실제 달력 날짜와 윤년을 확인한다', () => {
    expect(parseTermDate('2028. 02. 29.')).toBe('2028-02-29');
    expect(parseTermDate('2026. 02. 29.')).toBeNull();
    expect(parseTermDate('2026-11-10')).toBe('2026-11-10');
    expect(displayTermDate('abc')).toBe('abc');
  });
});
describe('R-약관판정·정렬·처음본문·자리표시자·날짜채움', () => {
  it.each([
    ['2026-10-07T10:00:00+09:00', ['과거', '현행', '예정', '초안']],
    ['2026-10-19T23:59:00+09:00', ['과거', '현행', '예정', '초안']],
    ['2026-10-20T00:00:00+09:00', ['과거', '과거', '현행', '초안']],
  ])('KST %s 공개 상태', (now, expected) =>
    expect(SERVICE.map((item) => getTermStatus(item, SERVICE, new Date(now)))).toEqual(expected)
  );
  it('기본 정렬과 철회 배제를 적용한다', () => {
    expect([...SERVICE].sort(compareTerms).map((item) => item.version)).toEqual([4, 3, 2, 1]);
    expect([...PRIVACY].sort(compareTerms).map((item) => item.version)).toEqual([2, 1]);
    expect(PRIVACY.map((item) => getTermStatus(item, PRIVACY, NOW))).toEqual(['현행', '철회']);
    expect(getInitialTermBody(PRIVACY)).toContain('개인정보 처리방침 1판');
    expect(
      getInitialTermBody(SERVICE.map((item) => (item.version === 3 ? { ...item, status: 'withdrawn' } : item)))
    ).toContain('서비스 이용약관 2판');
    expect(getInitialTermBody([])).toContain('공고일자: {{공고일}}');
  });
  it('복제 시 네 곳의 공개·시행일을 되돌리고 공개 시 모두 채운다', () => {
    const text = getInitialTermBody(SERVICE);
    expect(text).toContain('공고일자: {{공고일}}');
    expect(text).toContain('시행일자: {{시행일}}');
    expect(text).toContain('이 약관은 {{시행일}}부터 시행합니다.');
    expect(text).toContain('{{공고일}} 공고');
    const filled = fillTermDates(text, '2026-11-10', NOW);
    expect(filled).not.toContain('{{');
    expect(filled).toContain('공고일자: 2026년 10월 7일');
    expect(filled).toContain('시행일자: 2026년 11월 10일');
    expect(fillTermDates('{{공고일}}', '2026-11-10', new Date('2026-10-07T15:30:00Z'))).toBe('2026년 10월 8일');
    expect(fillTermDates('{{시행일}}부터 {{시행일}}까지', '2027-03-05', NOW)).toBe(
      '2027년 3월 5일부터 2027년 3월 5일까지'
    );
  });
});
