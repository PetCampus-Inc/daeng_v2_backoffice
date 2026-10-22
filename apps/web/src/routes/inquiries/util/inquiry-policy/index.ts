import type { InquiryStatus } from '../../type/inquiry';

/** 상태 전환에 필요한 문의 값. */
export type InquiryState = { status: InquiryStatus; assigneeEmail: string | null };

/** 문의에 일어나는 일. restore는 담당 해제 실행 취소다. */
export type InquiryEvent = 'assign' | 'release' | 'restore' | 'reply' | 'userFollowUp' | 'userClose';

/**
 * 문의 상태 전환(PRD 5.2, 7.4). 거부되면 null.
 * - 해결 완료는 모든 변경이 잠긴다.
 * - 맡으면 답변 대기만 확인 중으로 바뀌고 그 밖의 상태는 그대로다.
 * - 담당 해제·답변은 담당자 본인만, 실행 취소는 그 사이 아무도 맡지 않았을 때만.
 * - 사용자 추가 문의는 담당자를 유지한 채 답변 대기로, 종료는 답변 도착에서만 해결 완료로.
 */
export function transitionInquiry(state: InquiryState, event: InquiryEvent, actorEmail: string): InquiryState | null {
  if (state.status === 'resolved') return null;
  switch (event) {
    case 'assign':
      return { status: state.status === 'waiting' ? 'checking' : state.status, assigneeEmail: actorEmail };
    case 'release':
      return state.assigneeEmail === actorEmail ? { ...state, assigneeEmail: null } : null;
    case 'restore':
      return state.assigneeEmail === null ? { ...state, assigneeEmail: actorEmail } : null;
    case 'reply':
      return state.assigneeEmail === actorEmail ? { ...state, status: 'answered' } : null;
    case 'userFollowUp':
      return { ...state, status: 'waiting' };
    case 'userClose':
      return state.status === 'answered' ? { ...state, status: 'resolved' } : null;
  }
}

/**
 * 맡기 요청을 서버가 받아들일지(FR-BO-054). 화면에서 본 담당자와 실제 담당자가 다르면 바꾸지 않는다.
 */
export function checkAssignRequest(state: InquiryState, expectedAssigneeEmail: string | null) {
  if (state.status === 'resolved') return 'resolved' as const;
  return state.assigneeEmail === expectedAssigneeEmail ? ('ok' as const) : ('conflict' as const);
}

/** [내가 맡기]를 눌렀을 때 할 일. 미배정이면 바로 맡고, 다른 팀원 담당이면 담당 변경 확인창을 연다. */
export function getAssignAction(assigneeEmail: string | null, currentEmail: string) {
  if (assigneeEmail === null) return 'assign' as const;
  return assigneeEmail === currentEmail ? ('none' as const) : ('confirm' as const);
}

/** 상세 머리·답변 영역의 경우(7.4). 해결 완료 → 내가 담당 → 그 밖(미배정·다른 팀원) 순서로 본다. */
export function getInquiryViewMode(status: InquiryStatus, assigneeEmail: string | null, currentEmail: string) {
  if (status === 'resolved') return 'resolved' as const;
  return assigneeEmail === currentEmail ? ('mine' as const) : ('notMine' as const);
}

/** 쓰던 답변이 있으면(공백만이어도) 담당 해제 전에 확인한다(FR-BO-055, 4.6 '작성 중'). */
export function needsReleaseConfirm(draft: string) {
  return draft.length > 0;
}
