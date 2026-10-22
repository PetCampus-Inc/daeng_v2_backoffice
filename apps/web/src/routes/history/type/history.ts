import type { JobRole } from '@daeng/shared';
import type { Role } from '@/type/role';

/** 변경 이력 대상 종류(PRD 7.12). 툴바 선택지 순서와 같다. */
export const HISTORY_TARGET_TYPES = ['inquiry', 'notice', 'terms', 'teamMember'] as const;
export type HistoryTargetType = (typeof HISTORY_TARGET_TYPES)[number];

export const HISTORY_TARGET_TYPE_LABELS: Record<HistoryTargetType, string> = {
  inquiry: '1:1 문의',
  notice: '앱 공지',
  terms: '이용약관',
  teamMember: '팀원',
};

/** 약관 종류(TC fixtures `약관-기본`). 약관 화면을 만들면 그쪽 타입과 합친다. */
export const TERMS_TYPES = ['service', 'privacy', 'location'] as const;
export type TermsType = (typeof TERMS_TYPES)[number];

export const TERMS_TYPE_LABELS: Record<TermsType, string> = {
  service: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  location: '위치기반서비스 이용약관',
};

/** 기록하는 동작(PRD 6.6 기록 대상). 화면 글자는 PRD에 없어 6.6 용어를 그대로 쓴다(TC 08 메모). */
export const HISTORY_ACTION_LABELS = {
  assign: '맡기',
  changeAssignee: '담당자 변경',
  unassign: '담당 해제',
  saveReply: '답변 저장',
  create: '작성',
  update: '수정',
  publish: '게시',
  unpublish: '게시 해제',
  republish: '재게시',
  registerVersion: '새 버전 등록',
  publishVersion: '공개',
  withdrawVersion: '공개 철회',
  register: '등록',
  changeRole: '역할 변경',
  deactivate: '비활성화',
  cancelRegistration: '등록 취소',
  reactivate: '재활성화',
} as const;
export type HistoryAction = keyof typeof HISTORY_ACTION_LABELS;

/** 기록 당시의 행위자·담당자. 표시명·직무는 기록 당시 값이다. */
export type HistoryPerson = { displayName: string; jobRole: JobRole; email: string };

/** 대상 식별값(PRD 6.6). 공지 제목은 기록 당시 값이다. */
export type HistoryTarget =
  | { type: 'inquiry'; inquiryId: number }
  | { type: 'notice'; noticeId: number; title: string }
  | { type: 'terms'; termsType: TermsType; version: number }
  | { type: 'teamMember'; email: string };

/** 변경 전 → 후 값. 역할 변경·담당자 변경만 있다(PRD 6.6). 담당자 null은 미배정. */
export type HistoryChange =
  | { kind: 'role'; before: Role; after: Role }
  | { kind: 'assignee'; before: Omit<HistoryPerson, 'email'> | null; after: Omit<HistoryPerson, 'email'> | null };

/** 변경 이력 한 줄. */
export type HistoryRecord = {
  id: number;
  occurredAt: string;
  actor: HistoryPerson;
  target: HistoryTarget;
  action: HistoryAction;
  change: HistoryChange | null;
};

/** 행위자 필터 선택지. 계정(이메일) 기준이고 이름은 지금 표시명·직무다(TC R-이력필터 메모). */
export type HistoryActor = { email: string; displayName: string; jobRole: JobRole };

export const HISTORY_PERIODS = ['all', 'custom'] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** 목록 조건. 날짜는 KST `YYYY-MM-DD`, 비어 있으면 ''. 행위자는 `all` 또는 이메일. */
export type HistoryListParams = {
  period: HistoryPeriod;
  from: string;
  to: string;
  actor: string;
  targetType: HistoryTargetType | 'all';
};
