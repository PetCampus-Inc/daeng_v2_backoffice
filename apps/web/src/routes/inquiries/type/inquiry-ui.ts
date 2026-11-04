import { SortParameter } from '@/type/sort-parameter';
import { UserType } from '@/type/user-type';
import type { InquiryDetail as ServerInquiryDetail } from './inquiry-detail';
import { InquiryMessageAuthor as ServerMessageAuthor, type InquiryMessageAuthor } from './inquiry-message-author';
import type { InquiryMessage as ServerInquiryMessage } from './inquiry-message';
import { InquiryStatus as ServerInquiryStatus } from './inquiry-status';
import type { InquirySummary as ServerInquirySummary } from './inquiry-summary';

/** BO 문의 상태(PRD 5.2). 화면 값은 소문자, 서버 값은 대문자다. '확인 중'은 BO 안에서만 쓰고 앱에는 '답변 대기'로 내려간다. */
export const INQUIRY_STATUSES = ['waiting', 'checking', 'answered', 'resolved'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
/** 화면 상태에 맞는 서버 값(대문자). */
export const INQUIRY_STATUS_REQUEST_VALUES: Record<InquiryStatus, ServerInquiryStatus> = {
  waiting: ServerInquiryStatus.WAITING,
  checking: ServerInquiryStatus.CHECKING,
  answered: ServerInquiryStatus.ANSWERED,
  resolved: ServerInquiryStatus.RESOLVED,
};
/** 서버 상태에 맞는 화면 값(소문자). */
export const INQUIRY_STATUS_FROM_SERVER: Record<ServerInquiryStatus, InquiryStatus> = {
  [ServerInquiryStatus.WAITING]: 'waiting',
  [ServerInquiryStatus.CHECKING]: 'checking',
  [ServerInquiryStatus.ANSWERED]: 'answered',
  [ServerInquiryStatus.RESOLVED]: 'resolved',
};
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  waiting: '답변 대기',
  checking: '확인 중',
  answered: '답변 도착',
  resolved: '해결 완료',
};

/** 사용자 유형 값. 화면 주소(`?userType=`)에는 소문자로 남기고, 서버에는 대문자로 보낸다. */
export const INQUIRY_USER_TYPES = ['guardian', 'director'] as const;
export type InquiryUserType = (typeof INQUIRY_USER_TYPES)[number];
export const INQUIRY_USER_TYPE_LABELS: Record<InquiryUserType, string> = { guardian: '보호자', director: '원장' };
/** 화면 사용자 유형에 맞는 서버 값(대문자). */
export const INQUIRY_USER_TYPE_REQUEST_VALUES: Record<InquiryUserType, UserType> = {
  guardian: UserType.GUARDIAN,
  director: UserType.DIRECTOR,
};
/** 서버 사용자 유형에 맞는 화면 값(소문자). */
export const INQUIRY_USER_TYPE_FROM_SERVER: Record<UserType, InquiryUserType> = {
  [UserType.GUARDIAN]: 'guardian',
  [UserType.DIRECTOR]: 'director',
};

/** 정렬 값. 화면 주소(`?sort=`)에는 소문자로 남기고, 서버에는 대문자로 보낸다. */
export const INQUIRY_SORTS = ['latest', 'oldest'] as const;
export type InquirySort = (typeof INQUIRY_SORTS)[number];
/** 화면 정렬에 맞는 서버 값(대문자). */
export const INQUIRY_SORT_REQUEST_VALUES: Record<InquirySort, SortParameter> = {
  latest: SortParameter.LATEST,
  oldest: SortParameter.OLDEST,
};

/** 메시지 작성자. 화면 값은 소문자, 서버 값은 대문자다. */
export type InquiryMessageAuthorUi = 'user' | 'operator';
/** 서버 작성자에 맞는 화면 값(소문자). */
export const INQUIRY_MESSAGE_AUTHOR_FROM_SERVER: Record<InquiryMessageAuthor, InquiryMessageAuthorUi> = {
  [ServerMessageAuthor.USER]: 'user',
  [ServerMessageAuthor.OPERATOR]: 'operator',
};

/** 화면이 쓰는 문의 사용자. 서버 응답과 유형 글자(소문자)만 다르다. */
export type InquiryUser = Omit<ServerInquirySummary['user'], 'type'> & { type: InquiryUserType };

/** 화면이 쓰는 메시지. 서버 응답과 작성자 글자(소문자)만 다르다. */
export type InquiryMessage = Omit<ServerInquiryMessage, 'author'> & { author: InquiryMessageAuthorUi };

/** 화면이 쓰는 목록 한 행. 서버 응답과 상태·사용자 유형 글자(소문자)만 다르다. */
export type InquirySummary = Omit<ServerInquirySummary, 'status' | 'user'> & {
  status: InquiryStatus;
  user: InquiryUser;
};

/** 화면이 쓰는 상세. 접수 시각과 대화(시간순)를 더한다. */
export type InquiryDetail = InquirySummary & Pick<ServerInquiryDetail, 'createdAt'> & { messages: InquiryMessage[] };

/**
 * 화면의 문의 목록 조건. 담당자는 `all`·`me`·`unassigned` 또는 팀원 번호(숫자 글자)이고,
 * 화면 주소(`?assignee=`)에도 같은 값이 남는다.
 */
export type InquiryListParams = {
  keyword: string;
  status: InquiryStatus | 'all';
  userType: InquiryUserType | 'all';
  assignee: string;
  sort: InquirySort;
};
