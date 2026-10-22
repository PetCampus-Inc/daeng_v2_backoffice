import type { JobRole } from '@daeng/shared';

/** BO 문의 상태(PRD 5.2). '확인 중'은 BO 안에서만 쓰고 앱에는 '답변 대기'로 내려간다. */
export const INQUIRY_STATUSES = ['waiting', 'checking', 'answered', 'resolved'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_USER_TYPES = ['guardian', 'director'] as const;
export type InquiryUserType = (typeof INQUIRY_USER_TYPES)[number];

export const INQUIRY_SORTS = ['latest', 'oldest'] as const;
export type InquirySort = (typeof INQUIRY_SORTS)[number];

/** 문의 담당자. 비활성 팀원도 담당자로 남아 있을 수 있다. */
export type InquiryAssignee = {
  email: string;
  displayName: string;
  jobRole: JobRole;
  isActive: boolean;
};

export type InquiryUser = { type: InquiryUserType; name: string; email: string };

/** 메시지 이미지. HEIC·HEIF는 `url`이 서버 변환본이고 `originalUrl`로 원본을 받는다. */
export type InquiryImage = { id: string; url: string; originalUrl: string | null; fileName: string };

export type InquiryMessage = {
  id: string;
  author: 'user' | 'operator';
  authorName: string;
  body: string;
  createdAt: string;
  images: InquiryImage[];
};

/** 목록 한 행. */
export type InquirySummary = {
  id: number;
  status: InquiryStatus;
  title: string;
  user: InquiryUser;
  assignee: InquiryAssignee | null;
  lastActivityAt: string;
};

/** 상세. 접수 시각과 대화(시간순)를 더한다. */
export type InquiryDetail = InquirySummary & { createdAt: string; messages: InquiryMessage[] };

/** 목록 조건. 담당자는 `all`·`me`·`unassigned` 또는 팀원 이메일이다. */
export type InquiryListParams = {
  keyword: string;
  status: InquiryStatus | 'all';
  userType: InquiryUserType | 'all';
  assignee: string;
  sort: InquirySort;
};

/** 목록 조건 기준 앞뒤 문의 번호. 없으면 null. */
export type InquiryAdjacent = { prevId: number | null; nextId: number | null };

/** 맡기 요청. 화면에서 본 담당자를 함께 보내 서버가 그 사이 바뀌었는지 확인한다. */
export type AssignInquiryInput = { id: number; expectedAssigneeEmail: string | null };

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  waiting: '답변 대기',
  checking: '확인 중',
  answered: '답변 도착',
  resolved: '해결 완료',
};

export const INQUIRY_USER_TYPE_LABELS: Record<InquiryUserType, string> = {
  guardian: '보호자',
  director: '원장',
};

/** 요청 거부 사유 코드. 실제 값은 서버 확인 필요. */
export const INQUIRY_ERROR_CODES = {
  assigneeChanged: 'INQUIRY_ASSIGNEE_CHANGED',
  resolved: 'INQUIRY_RESOLVED',
  notFound: 'INQUIRY_NOT_FOUND',
} as const;
