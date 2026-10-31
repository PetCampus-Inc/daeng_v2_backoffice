/** 서비스 DB·Java의 KST 시각 문자열(`YYYY-MM-DD HH:mm:ss.ffffff`)을 UTC ISO 문자열로 바꾼다. */
export function kstToIso(value: string): string {
  return new Date(`${value.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}+09:00`).toISOString();
}

const KST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** KST 기준의 날짜(`YYYY-MM-DD`)와 시각(`YYYY-MM-DD HH:mm:ss`). 서비스 DB의 시각이 KST 문자열이라 같은 형식으로 비교한다. */
export function kstNow(now: Date = new Date()): { date: string; dateTime: string } {
  const part = Object.fromEntries(KST_PARTS.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${part.year}-${part.month}-${part.day}`;
  return { date, dateTime: `${date} ${part.hour}:${part.minute}:${part.second}` };
}

/** 오늘 날짜(KST, `YYYY-MM-DD`). */
export function todayInKst(now: Date = new Date()): string {
  return kstNow(now).date;
}

/** `YYYY-MM-DD`에 일수를 더한다(음수는 뺀다). 달력 계산이라 시간대와 무관하다. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
