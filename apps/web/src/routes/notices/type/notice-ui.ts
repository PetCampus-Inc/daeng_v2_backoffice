import type { RichContent } from '@/type/rich-content';
import type { Notice as ServerNotice } from './notice';
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
/** 화면이 쓰는 상세. 본문은 블록 값이고, 동시 수정을 막는 `version`을 가진다. 이미지는 이번 범위에서 다루지 않는다. */
export type Notice = NoticeSummary & Pick<ServerNotice, 'version'> & { body: NoticeBody };
export type NoticeInput = Pick<Notice, 'title' | 'body'>;
export type NoticeListParams = { keyword: string; status: NoticeStatus | 'all' };
