import type { RichContent } from '@/type/rich-content';

export const NOTICE_STATUSES = ['draft', 'published', 'unpublished'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  draft: '초안',
  published: '게시',
  unpublished: '게시 해제',
};

export type NoticeBody = RichContent;
export type Notice = {
  id: number;
  status: NoticeStatus;
  title: string;
  body: NoticeBody;
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string;
  revision: number;
};
export type NoticeInput = Pick<Notice, 'title' | 'body'>;
export type NoticeAction = 'save' | 'publish' | 'unpublish' | 'republish' | 'undo';
export type NoticeListParams = { keyword: string; status: NoticeStatus | 'all' };
