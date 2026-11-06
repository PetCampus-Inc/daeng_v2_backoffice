import type { RichContent } from '@/type/rich-content';
import { countRichTextLength, createRichContent, normalizeRichContent, replaceRichText } from '@/util/rich-content';
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
/**
 * 시행일 입력 칸 값을 저장 요청 값으로 바꾼다. 비어 있으면 `null`(시행일 없이 저장), 형식이 맞으면 `YYYY-MM-DD`,
 * 적었는데 형식이 틀리면 `undefined`.
 */
export function readTermDateInput(value: string): string | null | undefined {
  return value.trim() ? (parseTermDate(value) ?? undefined) : null;
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
/** 시행일은 초안 저장에서는 비워 둘 수 있고, 공개할 때만 필수다. */
export const TERM_DATE_REQUIRED_MESSAGE = '공개하려면 시행일을 입력해 주세요.';
export const TERM_DATE_DUPLICATED_MESSAGE =
  '같은 시행일로 공개된 버전이 이미 있습니다. 다른 날짜를 고르거나 그 버전을 철회해 주세요.';
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
/** 공개할 때의 시행일 검증. 비어 있으면 필수 안내, 아니면 형식 → 과거 → 7일 → 최근 공개 시행일 순으로 본다. */
export function validateEffectiveDate(value: string, versions: TermSummary[], now = new Date()): string | null {
  if (!value.trim()) return TERM_DATE_REQUIRED_MESSAGE;
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
/** 약관 본문 글자 수 상한(서버 명세). */
export const TERM_BODY_MAX_LENGTH = 100_000;
/**
 * 본문 글자 수를 서버 기준으로 센다(`countRichTextLength`: 블록 사이 줄바꿈 제외, 코드포인트 단위).
 * 상한을 넘으면 입력은 유지하고 저장·공개만 막는다.
 */
export function countTermBody(body: RichContent) {
  const count = countRichTextLength(body);
  return { count, isOverLimit: count > TERM_BODY_MAX_LENGTH };
}
/** 본문 글자 수 초과 안내. */
export function getTermBodyOverMessage(count: number) {
  return `본문은 ${TERM_BODY_MAX_LENGTH.toLocaleString()}자까지 입력할 수 있습니다. ${(count - TERM_BODY_MAX_LENGTH).toLocaleString()}자를 줄여 주세요.`;
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
/** 공개할 때 서버가 날짜로 바꾸는 본문 표시. */
const TERM_DATE_PLACEHOLDERS = ['공고일', '시행일'] as const;
export type TermDatePlaceholder = (typeof TERM_DATE_PLACEHOLDERS)[number];
/** 서식으로 쪼개져 서버가 날짜로 바꾸지 못하는 표시 한 건. `blockIndex`는 본문 맨 위 블록 기준 0부터 센 순서다. */
export type SplitTermPlaceholder = { placeholder: TermDatePlaceholder; blockIndex: number };

type PlateNode = { text?: unknown; type?: string; children?: PlateNode[] };

/** 글자를 직접 품은 블록(문단·제목·칸 안 문단 등)인지. 자식이 글자 조각이나 링크(인라인)면 그렇다. */
const isTextBlock = (node: PlateNode) =>
  !!node.children?.some((child) => typeof child.text === 'string' || child.type === 'a');

/** 블록 안의 글자 조각(leaf `text`)을 링크 같은 인라인 안쪽까지 순서대로 모은다. */
function collectLeafTexts(node: PlateNode): string[] {
  if (typeof node.text === 'string') return [node.text];
  return (node.children ?? []).flatMap(collectLeafTexts);
}

const countOccurrences = (text: string, search: string) => text.split(search).length - 1;

/**
 * 공개 전 검사. 서버는 `text` 조각 하나씩 `{{공고일}}`·`{{시행일}}`을 바꾸므로, 굵게·링크 같은 서식으로 표시가 여러 조각에
 * 걸치면 날짜가 채워지지 않는다. 가장 가까운 블록마다 조각을 이어 붙여 본 표시 수가 조각 안에 통째로 든 표시 수보다 많으면 쪼개진 것이다.
 * `{{`나 `}}`만 따로 떨어진 경우도 같다. 표·목록은 칸·항목 단위 블록으로 따로 본다.
 */
export function findSplitTermPlaceholders(body: RichContent): SplitTermPlaceholder[] {
  const found: SplitTermPlaceholder[] = [];
  const visit = (node: PlateNode, blockIndex: number) => {
    if (!isTextBlock(node)) {
      node.children?.forEach((child) => visit(child, blockIndex));
      return;
    }
    const leaves = collectLeafTexts(node);
    const joined = leaves.join('');
    for (const placeholder of TERM_DATE_PLACEHOLDERS) {
      const marker = `{{${placeholder}}}`;
      const wholeCount = leaves.reduce((sum, leaf) => sum + countOccurrences(leaf, marker), 0);
      const isAlreadyFound = found.some((item) => item.placeholder === placeholder && item.blockIndex === blockIndex);
      if (countOccurrences(joined, marker) > wholeCount && !isAlreadyFound) found.push({ placeholder, blockIndex });
    }
  };
  (body.blocks as PlateNode[]).forEach(visit);
  return found;
}
/** 쪼개진 표시가 있을 때 공개를 막으며 보여 주는 안내. 어느 표시인지 문구에 넣는다. */
export function getSplitPlaceholderMessage(splits: SplitTermPlaceholder[]): string {
  const names = TERM_DATE_PLACEHOLDERS.filter((name) => splits.some((item) => item.placeholder === name));
  return `본문의 ${names.map((name) => `{{${name}}}`).join('·')}에 굵게·링크 같은 서식이 들어 있어 날짜가 채워지지 않아요. 서식을 풀고 다시 입력해 주세요.`;
}
export function fillTermDates(body: RichContent, effectiveDate: string, now = new Date()) {
  return replaceRichText(body, [
    ['{{공고일}}', koreanTermDate(kstDate(now))],
    ['{{시행일}}', koreanTermDate(effectiveDate)],
  ]);
}
