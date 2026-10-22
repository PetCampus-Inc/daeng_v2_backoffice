const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};
const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', DATE_OPTIONS);
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  ...DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * 서버 시각을 KST로 표시한다(PRD 4.4). 날짜 `YYYY. MM. DD.`, hasTime이면 시각 `YYYY. MM. DD. HH:mm`.
 * 값이 없으면 '—'.
 */
export function formatDate(value: string | null, hasTime = false) {
  if (!value) return '—';
  return (hasTime ? DATE_TIME_FORMAT : DATE_FORMAT).format(new Date(value));
}
