import { describe, expect, it } from 'vitest';
import { ChangeLogAction } from '@/routes/history/type';
import { getInquiryAssigneeLog } from './index';

const ME = { displayName: '김운영', jobRole: 'PM' } as const;
const PREVIOUS = { displayName: '이담당', jobRole: 'FE' } as const;

describe('문의 담당자 변경 이력 규칙(서버 동작 기준)', () => {
  it('담당자가 없던 문의를 맡으면 미배정에서 나로 기록한다', () => {
    expect(getInquiryAssigneeLog({ event: 'assign', actorId: 2, actor: ME, previousAssigneeId: null })).toEqual({
      action: ChangeLogAction.INQUIRY_ASSIGNED,
      change: { from: null, to: '김운영', fromJobRole: null, toJobRole: 'PM' },
    });
  });

  it('다른 담당자의 문의를 맡으면 이전 담당자에서 나로 바뀐 것으로 기록한다', () => {
    expect(
      getInquiryAssigneeLog({
        event: 'assign',
        actorId: 2,
        actor: ME,
        previousAssigneeId: 3,
        previousMember: PREVIOUS,
      })
    ).toEqual({
      action: ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
      change: { from: '이담당', to: '김운영', fromJobRole: 'FE', toJobRole: 'PM' },
    });
  });

  it('이전 담당자 팀원 정보가 없으면 이전 이름·직무는 비운다', () => {
    expect(getInquiryAssigneeLog({ event: 'assign', actorId: 2, actor: ME, previousAssigneeId: 99 })?.change).toEqual({
      from: null,
      to: '김운영',
      fromJobRole: null,
      toJobRole: 'PM',
    });
  });

  it('이미 내가 담당자면 이력을 남기지 않는다', () => {
    expect(getInquiryAssigneeLog({ event: 'assign', actorId: 2, actor: ME, previousAssigneeId: 2 })).toBeNull();
  });

  it('담당을 해제하면 나에서 미배정으로 기록하고 새 담당자 직무는 없다', () => {
    expect(getInquiryAssigneeLog({ event: 'release', actorId: 2, actor: ME, previousAssigneeId: 2 })).toEqual({
      action: ChangeLogAction.INQUIRY_ASSIGNEE_RELEASED,
      change: { from: '김운영', to: null, fromJobRole: 'PM', toJobRole: null },
    });
  });

  it('해제를 실행 취소하면 맡기와 같은 종류로 기록한다', () => {
    expect(getInquiryAssigneeLog({ event: 'restore', actorId: 2, actor: ME, previousAssigneeId: null })).toEqual({
      action: ChangeLogAction.INQUIRY_ASSIGNED,
      change: { from: null, to: '김운영', fromJobRole: null, toJobRole: 'PM' },
    });
  });
});
