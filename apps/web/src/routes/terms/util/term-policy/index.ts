import type { RichContent } from '@/type/rich-content';
import { createRichContent, normalizeRichContent, replaceRichText } from '@/util/rich-content';
import type { Term, TermDisplayStatus, TermSummary } from '../../type/term-ui';

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
/** 공개 상태와 시행일로 화면 상태를 판정한다. 서버가 주는 `effectiveStatus`는 쓰지 않는다. */
export function getTermStatus(term: TermSummary, versions: TermSummary[], now = new Date()): TermDisplayStatus {
  if (term.status === 'draft') return '초안';
  if (term.status === 'withdrawn') return '철회';
  const today = kstDate(now);
  if (term.effectiveDate > today) return '예정';
  const current = versions
    .filter((item) => item.kind === term.kind && item.status === 'published' && item.effectiveDate <= today)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.version - left.version)[0];
  return current?.version === term.version ? '현행' : '과거';
}
/** 시행일 안내 문구. 화면 검증과 서버 오류 안내(`util/term-error`)가 함께 쓴다. */
export const TERM_DATE_FORMAT_MESSAGE = '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.';
export const TERM_DATE_PAST_MESSAGE = '과거 날짜는 시행일로 지정할 수 없습니다.';
export const TERM_DATE_NOT_LATEST_MESSAGE = '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.';
/** 공개일(KST)로부터 7일 뒤 날짜(`YYYY-MM-DD`). */
export function getMinimumTermDate(now = new Date()): string {
  const minimum = new Date(`${kstDate(now)}T00:00:00Z`);
  minimum.setUTCDate(minimum.getUTCDate() + 7);
  return minimum.toISOString().slice(0, 10);
}
export function getTermDateTooSoonMessage(now = new Date()): string {
  return `시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. ${displayTermDate(getMinimumTermDate(now))} 이후로 골라 주세요.`;
}
export function validateEffectiveDate(value: string, versions: TermSummary[], now = new Date()): string | null {
  const date = parseTermDate(value);
  if (!date) return TERM_DATE_FORMAT_MESSAGE;
  const today = kstDate(now);
  if (date < today) return TERM_DATE_PAST_MESSAGE;
  if (date < getMinimumTermDate(now)) return getTermDateTooSoonMessage(now);
  const latest = versions
    .filter((item) => item.status === 'published')
    .map((item) => item.effectiveDate)
    .sort()
    .at(-1);
  if (latest && date <= latest) return TERM_DATE_NOT_LATEST_MESSAGE;
  return null;
}
/** 같은 약관에서 시행일이 가장 늦은 공개 버전(예정 포함, 철회 제외). 같으면 번호가 큰 쪽. 없으면 `undefined`. */
export function findLatestPublishedTerm<Item extends TermSummary>(versions: Item[]): Item | undefined {
  return versions
    .filter((item) => item.status === 'published')
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.version - left.version)[0];
}
export const DEFAULT_TERM_BODY =
  '제1조 목적\n\n약관 내용을 입력해 주세요.\n\n공고일자: {{공고일}}\n시행일자: {{시행일}}';
export function getInitialTermBody(versions: Term[]) {
  const latest = versions
    .filter((item) => item.status === 'published')
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.version - left.version)[0];
  if (!latest) return createRichContent(DEFAULT_TERM_BODY);
  let body = normalizeRichContent(latest.body);
  // 명시된 공개일·시행일을 되돌리면서 문단과 인라인 서식은 유지한다.
  if (latest.publishedAt) {
    body = replaceRichText(body, [[koreanTermDate(kstDate(new Date(latest.publishedAt))), '{{공고일}}']]);
  }
  if (latest.effectiveDate) body = replaceRichText(body, [[koreanTermDate(latest.effectiveDate), '{{시행일}}']]);
  return body;
}
export function fillTermDates(body: RichContent, effectiveDate: string, now = new Date()) {
  return replaceRichText(body, [
    ['{{공고일}}', koreanTermDate(kstDate(now))],
    ['{{시행일}}', koreanTermDate(effectiveDate)],
  ]);
}
