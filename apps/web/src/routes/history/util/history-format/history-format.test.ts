import { describe, expect, it } from 'vitest';
import type { HistoryChange, HistoryTarget } from '../../type/history';
import { formatHistoryChange, formatHistoryTarget } from './index';

describe('R-이력대상표시. 대상 칸 글자', () => {
  it.each<[string, HistoryTarget, string]>([
    ['01 1:1 문의', { type: 'inquiry', inquiryId: 1041 }, '문의 #1041'],
    [
      '02 앱 공지는 기록 당시 제목까지',
      { type: 'notice', noticeId: 12, title: '10월 서비스 점검 안내' },
      '공지 #12 · 10월 서비스 점검 안내',
    ],
    ['03 이용약관', { type: 'terms', termsType: 'service', version: 3 }, '서비스 이용약관 버전 #3'],
    ['04 팀원', { type: 'teamMember', email: 'ops2@knockdog.test' }, 'ops2@knockdog.test'],
  ])('%s', (_, target, expected) => {
    expect(formatHistoryTarget(target)).toBe(expected);
  });
});

describe('R-이력기록. 변경 전 → 후', () => {
  const kimOps = { displayName: '김운영', jobRole: 'PM' } as const;
  const leeOps = { displayName: '이담당', jobRole: 'FE' } as const;

  it.each<[string, HistoryChange, string]>([
    ['02 담당자 변경', { kind: 'assignee', before: leeOps, after: kimOps }, '이담당 · FE → 김운영 · PM'],
    ['03 담당 해제는 미배정으로', { kind: 'assignee', before: kimOps, after: null }, '김운영 · PM → 미배정'],
    ['06 담당 해제 실행 취소는 미배정에서', { kind: 'assignee', before: null, after: kimOps }, '미배정 → 김운영 · PM'],
    ['24 역할 변경', { kind: 'role', before: 'operator', after: 'viewer' }, '운영자 → 조회자'],
  ])('%s', (_, change, expected) => {
    expect(formatHistoryChange(change)).toBe(expected);
  });
});
