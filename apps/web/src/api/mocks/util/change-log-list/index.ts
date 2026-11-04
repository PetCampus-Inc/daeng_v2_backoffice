import type { ChangeLog, ChangeLogTargetType } from '@/routes/history/type';

/** 가짜 서버의 변경 이력 목록 조건. 서버가 받는 값 그대로라 빈 값이 올 수 있다. */
export type MockChangeLogListParams = {
  from?: string;
  to?: string;
  actorId?: number;
  targetType?: ChangeLogTargetType;
};

/** 서버 시각을 KST 날짜 `YYYY-MM-DD`로 바꾸는 서식. 기간 판정은 KST 날짜 기준이다(PRD 7.12). */
const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 가짜 서버의 변경 이력 목록 규칙. 기간은 KST 날짜 기준이며 `to`일도 포함한다.
 * 행위자는 팀원 ID로, 대상 종류는 서버 값으로 거르고 최신순(같은 시각이면 번호가 큰 것 먼저)으로 돌려준다.
 */
export function getChangeLogList(items: ChangeLog[], params: MockChangeLogListParams): ChangeLog[] {
  return items
    .filter((item) => {
      const date = KST_DATE_FORMAT.format(new Date(item.occurredAt));
      return (
        (!params.from || date >= params.from) &&
        (!params.to || date <= params.to) &&
        (params.actorId === undefined || item.actor.id === params.actorId) &&
        (!params.targetType || item.targetType === params.targetType)
      );
    })
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.id - left.id);
}
