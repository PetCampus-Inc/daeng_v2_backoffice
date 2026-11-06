import type { RichContent } from '@/type/rich-content';
import { NoticeStatus as ServerNoticeStatus } from './notice-status';
import type { NoticeSummary as ServerNoticeSummary } from './notice-summary';

/** 공지 상태. 화면 값은 소문자, 서버 값은 대문자다. */
export const NOTICE_STATUSES = ['draft', 'published', 'unpublished'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  draft: '초안',
  published: '게시',
  unpublished: '게시 해제',
};
/** 화면 상태에 맞는 서버 값(대문자). */
export const NOTICE_STATUS_REQUEST_VALUES: Record<NoticeStatus, ServerNoticeStatus> = {
  draft: ServerNoticeStatus.DRAFT,
  published: ServerNoticeStatus.PUBLISHED,
  unpublished: ServerNoticeStatus.UNPUBLISHED,
};
/** 서버 상태에 맞는 화면 값(소문자). */
export const NOTICE_STATUS_FROM_SERVER: Record<ServerNoticeStatus, NoticeStatus> = {
  [ServerNoticeStatus.DRAFT]: 'draft',
  [ServerNoticeStatus.PUBLISHED]: 'published',
  [ServerNoticeStatus.UNPUBLISHED]: 'unpublished',
};

/** 화면이 쓰는 목록 한 행. 서버 응답과 상태 글자(소문자)만 다르다. */
export type NoticeSummary = Omit<ServerNoticeSummary, 'status'> & { status: NoticeStatus };

export type NoticeBody = RichContent;
/** 화면이 쓰는 상세. `body`는 편집·저장용 원본, `previewBody`는 읽기 화면에 보여 줄 본문이다. */
export type Notice = NoticeSummary & { body: NoticeBody; previewBody: NoticeBody };
export type NoticeInput = Pick<Notice, 'title' | 'body'>;
export type NoticeListParams = { keyword: string; status: NoticeStatus | 'all' };
