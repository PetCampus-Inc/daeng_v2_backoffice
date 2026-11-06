import type { ChangeLogChange } from '@/routes/history/type';
import { ChangeLogAction } from '@/routes/history/type';
import type { JobRole } from '@/type/job-role';

/** 이력에 이름·직무로 남기는 팀원. 이전 담당자가 이미 없으면 `undefined`다. */
export type InquiryChangeLogMember = { displayName: string; jobRole: JobRole };

/** 문의 담당자 이력을 만드는 데 필요한 입력. `previousMember`는 바뀌기 전 담당자다. */
export type InquiryAssigneeLogInput = {
  event: 'assign' | 'release' | 'restore';
  actorId: number;
  actor: InquiryChangeLogMember;
  previousAssigneeId: number | null;
  previousMember?: InquiryChangeLogMember;
};

/**
 * 서버(`inquiries.service.ts`의 assign·release·restore)의 이력 기록 규칙을 따라 하는 모의 서버 규칙이다.
 * 맡기: 담당자가 없었으면 `INQUIRY_ASSIGNED`(미배정 → 나), 다른 사람이었으면 `INQUIRY_ASSIGNEE_CHANGED`(이전 → 나).
 * 이미 내가 담당자였으면 바뀐 것이 없어 이력을 남기지 않는다(`null`).
 * 해제: `INQUIRY_ASSIGNEE_RELEASED`(나 → 미배정). 해제 실행 취소: 맡기와 같은 `INQUIRY_ASSIGNED`(미배정 → 나).
 */
export function getInquiryAssigneeLog(
  input: InquiryAssigneeLogInput
): { action: ChangeLogAction; change: ChangeLogChange } | null {
  const { event, actorId, actor, previousAssigneeId, previousMember } = input;
  if (event === 'release') {
    return {
      action: ChangeLogAction.INQUIRY_ASSIGNEE_RELEASED,
      change: { from: actor.displayName, to: null, fromJobRole: actor.jobRole, toJobRole: null },
    };
  }
  if (event === 'restore') {
    return {
      action: ChangeLogAction.INQUIRY_ASSIGNED,
      change: { from: null, to: actor.displayName, fromJobRole: null, toJobRole: actor.jobRole },
    };
  }
  if (previousAssigneeId === actorId) return null;
  return {
    action: previousAssigneeId === null ? ChangeLogAction.INQUIRY_ASSIGNED : ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED,
    change: {
      from: previousMember?.displayName ?? null,
      to: actor.displayName,
      fromJobRole: previousMember?.jobRole ?? null,
      toJobRole: actor.jobRole,
    },
  };
}
