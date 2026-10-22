import { describe, expect, it } from 'vitest';

import { fillSignupTrend } from './index';

// fixtures.md 기준 시각 2026. 10. 07. (수) 10:00 KST
const now = new Date('2026-10-07T10:00:00+09:00');

describe('fillSignupTrend', () => {
  it('오늘 포함 30일을 하루씩 채운다(2026. 09. 08.~2026. 10. 07.)', () => {
    const trend = fillSignupTrend([], now);
    expect(trend).toHaveLength(30);
    expect(trend[0].date).toBe('2026-09-08');
    expect(trend[15].date).toBe('2026-09-23');
    expect(trend[29].date).toBe('2026-10-07');
  });

  it('S-홈-006 서버가 빼고 준 날(09. 20.~09. 25.)은 0으로 채운다', () => {
    const rows = [
      { date: '2026-09-19', count: 2 },
      { date: '2026-09-26', count: 3 },
    ];
    const trend = fillSignupTrend(rows, now);
    const countOf = (date: string) => trend.find((item) => item.date === date)?.count;
    expect(countOf('2026-09-19')).toBe(2);
    ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].forEach((date) =>
      expect(countOf(date)).toBe(0)
    );
    expect(countOf('2026-09-26')).toBe(3);
  });

  it('기간 밖(31일 전, 내일) 날짜는 넣지 않는다', () => {
    const trend = fillSignupTrend(
      [
        { date: '2026-09-07', count: 9 },
        { date: '2026-10-08', count: 9 },
      ],
      now
    );
    expect(trend.every((item) => item.count === 0)).toBe(true);
  });

  it('오늘은 KST 날짜로 정한다(UTC 10. 06. 15:30 = KST 10. 07.)', () => {
    const trend = fillSignupTrend([], new Date('2026-10-06T15:30:00Z'));
    expect(trend[29].date).toBe('2026-10-07');
  });
});
