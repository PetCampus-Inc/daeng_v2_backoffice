import { describe, expect, it } from 'vitest';
import { ChangeLogAction, ChangeLogTargetType, type ChangeLog } from '../../type';
import { formatHistoryChange, formatHistoryTarget } from './index';

describe('R-이력대상표시. 대상 칸 글자', () => {
  it.each<[string, Pick<ChangeLog, 'targetType' | 'target'>, string]>([
    [
      '01 1:1 문의는 서버 글자 그대로',
      { targetType: ChangeLogTargetType.INQUIRY, target: { id: 1041, label: '문의 #1041' } },
      '문의 #1041',
    ],
    [
      '02 앱 공지는 번호 + 서버 제목',
      { targetType: ChangeLogTargetType.NOTICE, target: { id: 12, label: '10월 서비스 점검 안내' } },
      '공지 #12 · 10월 서비스 점검 안내',
    ],
    [
      '03 이용약관은 서버 글자 그대로',
      { targetType: ChangeLogTargetType.TERMS_VERSION, target: { id: 3, label: '서비스 이용약관 (시행 2026-11-20)' } },
      '서비스 이용약관 (시행 2026-11-20)',
    ],
    [
      '04 팀원',
      { targetType: ChangeLogTargetType.ACCOUNT, target: { id: 3, label: 'ops2@knockdog.test' } },
      'ops2@knockdog.test',
    ],
  ])('%s', (_, record, expected) => {
    expect(formatHistoryTarget(record)).toBe(expected);
  });
});

describe('R-이력기록. 변경 전 → 후', () => {
  it.each<[string, ChangeLogAction, { from: string | null; to: string | null }, string]>([
    [
      '01 맡기는 미배정에서 이름으로',
      ChangeLogAction.INQUIRY_ASSIGNED,
      { from: null, to: '김운영' },
      '미배정 → 김운영',
    ],
    [
      '02 담당자 변경은 이름만',
      ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
      { from: '이담당', to: '김운영' },
      '이담당 → 김운영',
    ],
    [
      '03 담당 해제는 미배정으로',
      ChangeLogAction.INQUIRY_ASSIGNEE_RELEASED,
      { from: '김운영', to: null },
      '김운영 → 미배정',
    ],
    [
      '24 역할 변경은 역할 이름으로',
      ChangeLogAction.ACCOUNT_ROLE_CHANGED,
      { from: 'OPERATOR', to: 'VIEWER' },
      '운영자 → 조회자',
    ],
  ])('%s', (_, action, change, expected) => {
    expect(formatHistoryChange(action, change)).toBe(expected);
  });
});
