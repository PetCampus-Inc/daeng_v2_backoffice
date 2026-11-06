import { describe, expect, it } from 'vitest';
import { ChangeLogAction, ChangeLogTargetType, type ChangeLog, type ChangeLogChange } from '../../type';
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
  it.each<[string, ChangeLogAction, ChangeLogChange, string]>([
    [
      '01 처음 맡기와 해제 실행 취소는 미배정에서 이름 · 직무로',
      ChangeLogAction.INQUIRY_ASSIGNED,
      { from: null, to: '김운영', fromJobRole: null, toJobRole: 'PM' },
      '미배정 → 김운영 · PM',
    ],
    [
      '02 담당자 변경은 이전·새 담당자 모두 이름 · 직무',
      ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
      { from: '이담당', to: '김운영', fromJobRole: 'FE', toJobRole: 'PM' },
      '이담당 · FE → 김운영 · PM',
    ],
    [
      '03 담당 해제는 새 담당자 없이 미배정으로',
      ChangeLogAction.INQUIRY_ASSIGNEE_RELEASED,
      { from: '김운영', to: null, fromJobRole: 'PM', toJobRole: null },
      '김운영 · PM → 미배정',
    ],
    [
      '04 직무를 기록하기 전 이력은 이름만',
      ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
      { from: '이담당', to: '김운영', fromJobRole: null, toJobRole: null },
      '이담당 → 김운영',
    ],
    [
      '05 한쪽만 직무가 있으면 있는 쪽만 붙는다',
      ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
      { from: '이담당', to: '김운영', fromJobRole: null, toJobRole: 'BE' },
      '이담당 → 김운영 · BE',
    ],
    [
      '24 역할 변경은 역할 이름으로',
      ChangeLogAction.ACCOUNT_ROLE_CHANGED,
      { from: 'OPERATOR', to: 'VIEWER', fromJobRole: null, toJobRole: null },
      '운영자 → 조회자',
    ],
  ])('%s', (_, action, change, expected) => {
    expect(formatHistoryChange(action, change)).toBe(expected);
  });

  it.each<[ChangeLogChange['toJobRole'], string]>([
    ['PM', 'PM'],
    ['UX_UI', 'UX/UI'],
    ['FE', 'FE'],
    ['BE', 'BE'],
    ['FULL_STACK', '풀스택'],
  ])('직무 %s는 화면 이름 %s로 보인다', (jobRole, label) => {
    const change = { from: null, to: '김운영', fromJobRole: null, toJobRole: jobRole };
    expect(formatHistoryChange(ChangeLogAction.INQUIRY_ASSIGNED, change)).toBe(`미배정 → 김운영 · ${label}`);
  });
});
