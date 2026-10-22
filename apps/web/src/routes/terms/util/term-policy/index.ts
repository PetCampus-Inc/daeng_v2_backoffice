import type { Term, TermDisplayStatus } from '../../type/term';

export function kstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function parseTermDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? normalized : null;
}
export function displayTermDate(value: string) {
  const parsed = parseTermDate(value);
  return parsed ? parsed.replaceAll('-', '. ') + '.' : value;
}
export function koreanTermDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
export function getTermStatus(term: Term, versions: Term[], now = new Date()): TermDisplayStatus {
  if (term.status === 'draft') return '초안';
  if (term.status === 'withdrawn') return '철회';
  const today = kstDate(now);
  if (term.effectiveDate > today) return '예정';
  const current = versions
    .filter((item) => item.kind === term.kind && item.status === 'published' && item.effectiveDate <= today)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.version - left.version)[0];
  return current?.version === term.version ? '현행' : '과거';
}
export function compareTerms(left: Term, right: Term) {
  // 시행일 있는 초안 정렬은 PRD 미확정. 개발 mock에서는 초안을 먼저 표시한다.
  return (
    Number(right.status === 'draft') - Number(left.status === 'draft') ||
    right.effectiveDate.localeCompare(left.effectiveDate) ||
    right.version - left.version
  );
}
export function validateEffectiveDate(value: string, versions: Term[], now = new Date()): string | null {
  const date = parseTermDate(value);
  if (!date) return '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.';
  const today = kstDate(now);
  if (date < today) return '과거 날짜는 시행일로 지정할 수 없습니다.';
  const minimum = new Date(`${today}T00:00:00Z`);
  minimum.setUTCDate(minimum.getUTCDate() + 7);
  const minimumDate = minimum.toISOString().slice(0, 10);
  if (date < minimumDate) {
    return `시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. ${displayTermDate(minimumDate)} 이후로 골라 주세요.`;
  }
  const latest = versions
    .filter((item) => item.status === 'published')
    .map((item) => item.effectiveDate)
    .sort()
    .at(-1);
  if (latest && date <= latest) return '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.';
  return null;
}
export const DEFAULT_TERM_BODY =
  '제1조 목적\n\n약관 내용을 입력해 주세요.\n\n공고일자: {{공고일}}\n시행일자: {{시행일}}';
export function getInitialTermBody(versions: Term[]) {
  const latest = versions
    .filter((item) => item.status === 'published')
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.version - left.version)[0];
  if (!latest) return DEFAULT_TERM_BODY;
  let body = latest.body;
  // 일반 텍스트 계약에서는 명시된 공개일·시행일만 되돌린다.
  if (latest.publishedAt) body = body.replaceAll(koreanTermDate(kstDate(new Date(latest.publishedAt))), '{{공고일}}');
  if (latest.effectiveDate) body = body.replaceAll(koreanTermDate(latest.effectiveDate), '{{시행일}}');
  return body;
}
export function fillTermDates(body: string, effectiveDate: string, now = new Date()) {
  return body
    .replaceAll('{{공고일}}', koreanTermDate(kstDate(now)))
    .replaceAll('{{시행일}}', koreanTermDate(effectiveDate));
}
