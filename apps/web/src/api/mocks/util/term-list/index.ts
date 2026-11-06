import { TermsEffectiveStatus } from '@/type/terms-effective-status';
import {
  TermsEffectiveDateErrorCode,
  TermsKind,
  TermsPublishStatus,
  type TermsVersion,
  type TermsVersionSummary,
} from '@/routes/terms/type';
import { koreanTermDate } from '@/routes/terms/util/term-policy';
import type { RichContent } from '@/type/rich-content';

/** 가짜 서버에 저장하는 약관 버전. 서버 상세 응답과 같은 모양에서 시행 상태(`effectiveStatus`)만 뺀 값이다. 시각은 UTC다. */
export type MockTerm = Omit<TermsVersion, 'effectiveStatus'>;

/** 입력 검증 실패. 서버의 400 `details` 한 줄이다. */
export type MockTermIssue = { field: string; reason: string };

/** 약관 번호 규칙: 1 이상의 안전한 정수만(서버 id 파이프). 아니면 undefined. */
export function parseTermId(rawId: unknown): number | undefined {
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) return undefined;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : undefined;
}

/** 약관 종류 규칙: 서버 종류 세 가지만. 아니면 undefined. */
export function parseTermKind(rawKind: unknown): TermsKind | undefined {
  return Object.values(TermsKind).find((kind) => kind === rawKind);
}

/** 서버 날짜 규칙(`YYYY-MM-DD`, 실제 달력 날짜)에 맞는지 본다. */
export function isTermDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** KST 기준 날짜(`YYYY-MM-DD`). */
export function kstDateOf(now: Date): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/**
 * 서버 정렬: 초안이 맨 위에 최근 생성순(번호 내림차순), 나머지는 시행일 내림차순이고 같으면 번호가 큰 것 먼저.
 */
export function compareTermVersions(left: MockTerm, right: MockTerm) {
  const isLeftDraft = left.publishStatus === TermsPublishStatus.DRAFT;
  const isRightDraft = right.publishStatus === TermsPublishStatus.DRAFT;
  if (isLeftDraft !== isRightDraft) return isLeftDraft ? -1 : 1;
  if (isLeftDraft) return right.id - left.id;
  return (right.effectiveDate ?? '').localeCompare(left.effectiveDate ?? '') || right.id - left.id;
}

/** 오늘 시행 중인 버전의 번호. 공개된 버전 중 시행일이 오늘 이전이면서 가장 늦은 것이다(같으면 번호가 큰 쪽). */
function currentTermId(items: MockTerm[], today: string): number | undefined {
  return items
    .filter(
      (item) => item.publishStatus === TermsPublishStatus.PUBLISHED && item.effectiveDate && item.effectiveDate <= today
    )
    .sort(compareTermVersions)[0]?.id;
}

/** 목록 응답 한 행. 공개된 버전만 시행 상태(`effectiveStatus`)를 가진다. `items`는 같은 종류의 전체 버전이다. */
export function toTermSummaryResponse(item: MockTerm, items: MockTerm[], now = new Date()): TermsVersionSummary {
  const today = kstDateOf(now);
  let effectiveStatus: TermsVersionSummary['effectiveStatus'] = null;
  if (item.publishStatus === TermsPublishStatus.PUBLISHED) {
    if (item.effectiveDate && item.effectiveDate > today) {
      effectiveStatus = TermsEffectiveStatus.SCHEDULED;
    } else {
      effectiveStatus =
        item.id === currentTermId(items, today) ? TermsEffectiveStatus.CURRENT : TermsEffectiveStatus.PAST;
    }
  }
  return {
    id: item.id,
    kind: item.kind,
    effectiveDate: item.effectiveDate,
    publishStatus: item.publishStatus,
    effectiveStatus,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    version: item.version,
  };
}

/** 상세 응답. 목록 한 행에 본문·공고일이 더해진다. */
export function toTermResponse(item: MockTerm, items: MockTerm[], now = new Date()): TermsVersion {
  return {
    ...toTermSummaryResponse(item, items, now),
    content: item.content,
    announcedDate: item.announcedDate,
  };
}

/** 같은 종류의 전체 버전을 서버 정렬로 돌려준다. */
export function getTermList(all: MockTerm[], kind: TermsKind): MockTerm[] {
  return all.filter((item) => item.kind === kind).sort(compareTermVersions);
}

/**
 * 공개할 때의 시행일 검증. 서버처럼 공개일(KST)로부터 7일 이후여야 하고, 같은 종류의 공개(PUBLISHED) 버전과 시행일이
 * 같으면 안 되며(철회·초안은 비교하지 않음), 그 검사 뒤에 공개 버전 중 가장 늦은 시행일보다 뒤여야 한다. 시행일이 비어 있으면 `TERMS_EFFECTIVE_DATE_REQUIRED`다. 통과하면 undefined, 아니면 서버 오류 코드와 안내다.
 */
export function checkPublishDate(
  effectiveDate: string | null,
  versions: MockTerm[],
  now = new Date()
): { code: TermsEffectiveDateErrorCode; message: string } | undefined {
  if (effectiveDate === null) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_REQUIRED,
      message: '시행일이 비어 있어 공개할 수 없습니다.',
    };
  }
  if (!isTermDate(effectiveDate)) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_INVALID_FORMAT,
      message: '시행일 형식이 올바르지 않습니다.',
    };
  }
  const today = kstDateOf(now);
  if (effectiveDate < today) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_IN_PAST,
      message: '과거 날짜는 시행일로 지정할 수 없습니다.',
    };
  }
  const minimum = new Date(`${today}T00:00:00Z`);
  minimum.setUTCDate(minimum.getUTCDate() + 7);
  if (effectiveDate < minimum.toISOString().slice(0, 10)) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_TOO_SOON,
      message: '시행일은 공개일로부터 7일 이후여야 합니다.',
    };
  }
  // 서버처럼 공개 상태인 다른 버전과 시행일이 같으면 중복이다. 초안·철회는 비교하지 않고, 가장 늦은 시행일 검사보다 먼저 본다.
  if (
    versions.some((item) => item.publishStatus === TermsPublishStatus.PUBLISHED && item.effectiveDate === effectiveDate)
  ) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_DUPLICATED,
      message: '같은 시행일로 공개된 버전이 이미 있습니다.',
    };
  }
  const latest = versions
    .filter((item) => item.publishStatus === TermsPublishStatus.PUBLISHED && item.effectiveDate)
    .map((item) => item.effectiveDate as string)
    .sort()
    .at(-1);
  if (latest && effectiveDate <= latest) {
    return {
      code: TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST,
      message: '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.',
    };
  }
  return undefined;
}

/** 철회할 수 있는지 본다. 공개 상태이고 시행일이 아직 오지 않은(예정) 버전만 철회할 수 있다. */
export function canWithdrawTerm(item: MockTerm, now = new Date()): boolean {
  return (
    item.publishStatus === TermsPublishStatus.PUBLISHED && !!item.effectiveDate && item.effectiveDate > kstDateOf(now)
  );
}

/**
 * 공개할 때 서버처럼 본문의 `text` 조각 하나씩 `{{공고일}}`·`{{시행일}}`을 날짜로 바꾼다.
 * 서식으로 여러 조각에 걸친 표시는 바뀌지 않고 그대로 남는다(`replaceRichText`는 조각을 이어 붙여 바꾸므로 쓰지 않는다).
 */
export function fillPublishedTermDates(body: RichContent, effectiveDate: string, now: Date): RichContent {
  const announced = koreanTermDate(kstDateOf(now));
  const effective = koreanTermDate(effectiveDate);
  const mapNode = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(mapNode);
    if (typeof node !== 'object' || node === null) return node;
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        key === 'text' && typeof value === 'string'
          ? value.replaceAll('{{공고일}}', announced).replaceAll('{{시행일}}', effective)
          : mapNode(value),
      ])
    );
  };
  return mapNode(body) as RichContent;
}
