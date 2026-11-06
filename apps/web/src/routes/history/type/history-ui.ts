import { ChangeLogAction } from './change-log-action';
import { ChangeLogTargetType } from './change-log-target-type';

/** 변경 이력 대상 종류(PRD 7.12). 툴바 선택지 순서와 같다. 주소(`?targetType=`)에는 이 값을 남기고, 서버에는 대문자 값으로 보낸다. */
export const HISTORY_TARGET_TYPES = ['inquiry', 'notice', 'terms', 'teamMember'] as const;
export type HistoryTargetType = (typeof HISTORY_TARGET_TYPES)[number];

export const HISTORY_TARGET_TYPE_LABELS: Record<HistoryTargetType, string> = {
  inquiry: '1:1 문의',
  notice: '앱 공지',
  terms: '이용약관',
  teamMember: '팀원',
};

/** 화면 대상 종류에 맞는 서버 값. */
export const HISTORY_TARGET_TYPE_REQUEST_VALUES: Record<HistoryTargetType, ChangeLogTargetType> = {
  inquiry: ChangeLogTargetType.INQUIRY,
  notice: ChangeLogTargetType.NOTICE,
  terms: ChangeLogTargetType.TERMS_VERSION,
  teamMember: ChangeLogTargetType.ACCOUNT,
};

/** 서버 대상 종류에 맞는 화면 값. */
export const HISTORY_TARGET_TYPE_FROM_SERVER: Record<ChangeLogTargetType, HistoryTargetType> = {
  [ChangeLogTargetType.INQUIRY]: 'inquiry',
  [ChangeLogTargetType.NOTICE]: 'notice',
  [ChangeLogTargetType.TERMS_VERSION]: 'terms',
  [ChangeLogTargetType.ACCOUNT]: 'teamMember',
};

/**
 * 서버가 기록하는 동작의 화면 글자(PRD 6.6 용어). 서버의 `NOTICE_CREATED`는 '처음 게시'를 뜻해 '게시'로 보인다(OQ-D26).
 * 서버는 처음 맡기와 담당 해제 실행 취소를 모두 `INQUIRY_ASSIGNED`(없음 → 이름)로 남겨 화면이 구분할 수 없으므로
 * '담당자 변경'으로 표시한다(OQ-D27, OQ-P12).
 */
export const HISTORY_ACTION_LABELS: Record<ChangeLogAction, string> = {
  [ChangeLogAction.INQUIRY_ASSIGNED]: '담당자 변경',
  [ChangeLogAction.INQUIRY_ASSIGNEE_CHANGED]: '담당자 변경',
  [ChangeLogAction.INQUIRY_ASSIGNEE_RELEASED]: '담당 해제',
  [ChangeLogAction.INQUIRY_REPLIED]: '답변 저장',
  [ChangeLogAction.NOTICE_CREATED]: '게시',
  [ChangeLogAction.NOTICE_EDITED]: '수정',
  [ChangeLogAction.NOTICE_UNPUBLISHED]: '게시 해제',
  [ChangeLogAction.NOTICE_REPUBLISHED]: '재게시',
  [ChangeLogAction.TERMS_VERSION_CREATED]: '새 버전 등록',
  [ChangeLogAction.TERMS_VERSION_PUBLISHED]: '공개',
  [ChangeLogAction.TERMS_VERSION_WITHDRAWN]: '공개 철회',
  [ChangeLogAction.ACCOUNT_REGISTERED]: '등록',
  [ChangeLogAction.ACCOUNT_ROLE_CHANGED]: '역할 변경',
  [ChangeLogAction.ACCOUNT_DEACTIVATED]: '비활성화',
  [ChangeLogAction.ACCOUNT_REGISTRATION_CANCELLED]: '등록 취소',
  [ChangeLogAction.ACCOUNT_REACTIVATED]: '재활성화',
};

export const HISTORY_PERIODS = ['all', 'custom'] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** 화면의 목록 조건. 날짜는 KST `YYYY-MM-DD`, 비어 있으면 ''. 행위자는 `all` 또는 주소에 남은 이메일이다. */
export type HistoryListParams = {
  period: HistoryPeriod;
  from: string;
  to: string;
  actor: string;
  targetType: HistoryTargetType | 'all';
};
