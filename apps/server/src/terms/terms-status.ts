import type { JavaTerms } from './terms-java.client.js';

export type EffectiveStatus = 'CURRENT' | 'SCHEDULED' | 'PAST';

/** 오늘 날짜(KST, `YYYY-MM-DD`). */
export function todayInKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 오늘 시행 중인 버전의 ID. 공개된 버전 중 시행일이 오늘 이전이면서 가장 늦은 것이다(같으면 ID가 큰 쪽). */
export function currentVersionId(versions: readonly JavaTerms[], today: string): number | undefined {
  return versions
    .filter((v) => v.status === 'PUBLISHED' && v.effectiveDate && v.effectiveDate <= today)
    .sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || b.id - a.id)[0]?.id;
}

/** 공개된 버전만 시행 상태를 가진다. 초안·철회 버전은 null이다. */
export function effectiveStatusOf(
  version: JavaTerms,
  today: string,
  currentId: number | undefined
): EffectiveStatus | null {
  if (version.status !== 'PUBLISHED') return null;
  if (version.effectiveDate && version.effectiveDate > today) return 'SCHEDULED';
  return version.id === currentId ? 'CURRENT' : 'PAST';
}
