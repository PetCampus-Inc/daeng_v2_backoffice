import type { SignupTrendItem } from '@/type/overview';
import { toCount } from '@/util/count-format';

/** 신규 가입 추이 기간(오늘 포함). */
export const SIGNUP_TREND_DAYS = 30;

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** 지금 시각의 KST 날짜에서 `daysAgo`일 전 날짜 `YYYY-MM-DD`. */
const getKstDate = (now: Date, daysAgo: number) => {
  const parts = KST_DATE_FORMAT.formatToParts(now);
  const [year, month, day] = (['year', 'month', 'day'] as const).map((type) =>
    Number(parts.find((part) => part.type === type)?.value)
  );
  return new Date(Date.UTC(year, month - 1, day - daysAgo)).toISOString().slice(0, 10);
};

/**
 * 오늘(KST) 포함 30일을 하루 한 칸으로 채운다. 서버가 빼고 준 날·이상한 건수는 0으로 둔다(S-홈-006).
 * 기간 밖 날짜와 날짜를 읽을 수 없는 줄은 버린다.
 */
export const fillSignupTrend = (rows: SignupTrendItem[] | null | undefined, now: Date): SignupTrendItem[] => {
  const countByDate = new Map<string, number>();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const date = typeof row?.date === 'string' && DATE_PATTERN.test(row.date) ? row.date.slice(0, 10) : null;
    if (date) countByDate.set(date, (countByDate.get(date) ?? 0) + toCount(row.count));
  });
  return Array.from({ length: SIGNUP_TREND_DAYS }, (_, index) => {
    const date = getKstDate(now, SIGNUP_TREND_DAYS - 1 - index);
    return { date, count: countByDate.get(date) ?? 0 };
  });
};
