import { describe, expect, it } from 'vitest';
import type { ChangeLog } from '@/routes/history/type';
import { getChangeLogList, type MockChangeLogListParams } from './index';

const log = (id: number, occurredAt: string, actorId: number, targetType: ChangeLog['targetType']): ChangeLog => ({
  id,
  occurredAt,
  actor: { id: actorId, displayName: '김운영', jobRole: 'PM', email: `a${actorId}@knockdog.test` },
  targetType,
  target: { id, label: `대상 ${id}` },
  action: 'INQUIRY_REPLIED',
  change: null,
});

/** KST 10월 4일 00:30(UTC로는 3일)이 들어 있는 작은 이력. */
const LOGS = [
  log(1, '2026-10-01T09:00:00+09:00', 1, 'TERMS_VERSION'),
  log(2, '2026-10-01T09:00:00+09:00', 1, 'TERMS_VERSION'),
  log(3, '2026-10-03T15:30:00Z', 3, 'INQUIRY'),
  log(4, '2026-10-05T10:00:00+09:00', 2, 'NOTICE'),
];

describe('이력 목록 TC R-이력기간·R-이력필터', () => {
  it.each<[string, MockChangeLogListParams, number[]]>([
    ['조건 없음은 최신순, 같은 시각이면 번호가 큰 것 먼저', {}, [4, 3, 2, 1]],
    ['종료일은 그날을 포함한다', { from: '2026-10-01', to: '2026-10-01' }, [2, 1]],
    ['기간은 KST 날짜 기준이다', { from: '2026-10-04', to: '2026-10-04' }, [3]],
    ['행위자는 팀원 ID로 거른다', { actorId: 1 }, [2, 1]],
    ['대상 종류는 서버 값으로 거른다', { targetType: 'NOTICE' }, [4]],
  ])('%s', (_, params, expected) => {
    expect(getChangeLogList(LOGS, params).map((item) => item.id)).toEqual(expected);
  });
});
