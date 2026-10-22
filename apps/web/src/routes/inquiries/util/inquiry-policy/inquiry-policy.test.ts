import { describe, expect, it } from 'vitest';
import type { InquiryStatus } from '../../type/inquiry';
import {
  checkAssignRequest,
  getAssignAction,
  getInquiryViewMode,
  needsReleaseConfirm,
  transitionInquiry,
  type InquiryEvent,
} from '.';

const ME = 'me@example.com';
const OTHER_A = 'a@example.com';
const OTHER_B = 'b@example.com';

type Row = [string, InquiryStatus, string | null, InquiryEvent, InquiryStatus | null, string | null];

// R-문의상태 표. 담당자 변경은 다른 팀원 담당 문의를 맡는 것(assign)이다. 다음 상태 null = 해결 완료(거부).
const TRANSITION_ROWS: Row[] = [
  ['01', 'waiting', null, 'assign', 'checking', ME],
  ['02', 'waiting', OTHER_A, 'assign', 'checking', ME],
  ['03', 'checking', OTHER_A, 'assign', 'checking', ME],
  ['04', 'answered', null, 'assign', 'answered', ME],
  ['05', 'answered', OTHER_A, 'assign', 'answered', ME],
  ['06', 'waiting', ME, 'release', 'waiting', null],
  ['07', 'checking', ME, 'release', 'checking', null],
  ['08', 'answered', ME, 'release', 'answered', null],
  ['09', 'checking', null, 'restore', 'checking', ME],
  ['10', 'waiting', ME, 'reply', 'answered', ME],
  ['11', 'checking', ME, 'reply', 'answered', ME],
  ['12', 'answered', ME, 'reply', 'answered', ME],
  ['13', 'waiting', ME, 'userFollowUp', 'waiting', ME],
  ['14', 'checking', ME, 'userFollowUp', 'waiting', ME],
  ['15', 'answered', ME, 'userFollowUp', 'waiting', ME],
  ['16', 'answered', null, 'userFollowUp', 'waiting', null],
  ['17', 'answered', ME, 'userClose', 'resolved', ME],
  ['18', 'resolved', ME, 'assign', null, ME],
  ['19', 'resolved', OTHER_A, 'assign', null, OTHER_A],
  ['20', 'resolved', ME, 'release', null, ME],
  ['21', 'resolved', ME, 'reply', null, ME],
];

describe('R-문의상태 문의 상태 전환', () => {
  it.each(TRANSITION_ROWS)('R-문의상태-%s', (_id, status, assigneeEmail, event, nextStatus, nextAssignee) => {
    const next = transitionInquiry({ status, assigneeEmail }, event, ME);
    if (nextStatus === null) expect(next).toBeNull();
    else expect(next).toEqual({ status: nextStatus, assigneeEmail: nextAssignee });
  });
});

describe('R-문의상세경우 상세 머리·답변 영역', () => {
  it('R-문의상세경우-01 확인 중 + 내 담당이면 답변할 수 있다', () =>
    expect(getInquiryViewMode('checking', ME, ME)).toBe('mine'));
  it('R-문의상세경우-02 미배정이면 맡아야 답변할 수 있다', () =>
    expect(getInquiryViewMode('waiting', null, ME)).toBe('notMine'));
  it('R-문의상세경우-03·04 다른 팀원 담당(활성·비활성)이면 맡아야 답변할 수 있다', () =>
    expect(getInquiryViewMode('checking', OTHER_A, ME)).toBe('notMine'));
  it('R-문의상세경우-05 해결 완료면 내 담당이어도 잠긴다', () =>
    expect(getInquiryViewMode('resolved', ME, ME)).toBe('resolved'));
  it('R-문의상세경우-06 해결 완료면 미배정이어도 잠긴다', () =>
    expect(getInquiryViewMode('resolved', null, ME)).toBe('resolved'));
});

describe('R-맡기 내가 맡기 처리', () => {
  /** 화면에서 본 담당자로 판단하고, 서버가 거부하면 실제 담당자로 다시 판단한다. */
  const resolveAssign = (seen: string | null, actual: string | null) => {
    const firstAction = getAssignAction(seen, ME);
    const result = checkAssignRequest({ status: 'checking', assigneeEmail: actual }, seen);
    return { firstAction, result, retryAction: result === 'conflict' ? getAssignAction(actual, ME) : null };
  };

  it('R-맡기-01 미배정으로 보고 실제도 미배정이면 확인 없이 맡는다', () =>
    expect(resolveAssign(null, null)).toEqual({ firstAction: 'assign', result: 'ok', retryAction: null }));
  it('R-맡기-02 A 담당이면 확인창을 거쳐 맡는다', () =>
    expect(resolveAssign(OTHER_A, OTHER_A)).toEqual({ firstAction: 'confirm', result: 'ok', retryAction: null }));
  it('R-맡기-03 미배정으로 봤는데 B가 맡았으면 바꾸지 않고 B 확인창', () =>
    expect(resolveAssign(null, OTHER_B)).toEqual({
      firstAction: 'assign',
      result: 'conflict',
      retryAction: 'confirm',
    }));
  it('R-맡기-04 A로 봤는데 B로 바뀌었으면 바꾸지 않고 B 확인창', () =>
    expect(resolveAssign(OTHER_A, OTHER_B)).toEqual({
      firstAction: 'confirm',
      result: 'conflict',
      retryAction: 'confirm',
    }));
  it('R-맡기-05 A로 봤는데 해제됐으면 확인 없이 맡는다', () =>
    expect(resolveAssign(OTHER_A, null)).toEqual({
      firstAction: 'confirm',
      result: 'conflict',
      retryAction: 'assign',
    }));
  it('해결 완료 문의는 맡기를 거부한다(FR-BO-059)', () =>
    expect(checkAssignRequest({ status: 'resolved', assigneeEmail: null }, null)).toBe('resolved'));
});

describe('R-담당해제 담당 해제 처리', () => {
  it('R-담당해제-01 답변 입력이 비어 있으면 확인 없이 해제', () => expect(needsReleaseConfirm('')).toBe(false));
  it('R-담당해제-02 쓰던 답변이 있으면 확인창', () => expect(needsReleaseConfirm('확인해 보겠습니다')).toBe(true));
  it('R-담당해제-03 공백만 입력해도 확인창', () => expect(needsReleaseConfirm('   ')).toBe(true));
  it('R-담당해제-04 실행 취소 전 아무도 맡지 않았으면 다시 내 담당', () =>
    expect(transitionInquiry({ status: 'checking', assigneeEmail: null }, 'restore', ME)).toEqual({
      status: 'checking',
      assigneeEmail: ME,
    }));
  it('R-담당해제-05 실행 취소 전 다른 사람이 맡았으면 실패', () =>
    expect(transitionInquiry({ status: 'checking', assigneeEmail: OTHER_A }, 'restore', ME)).toBeNull());
});
